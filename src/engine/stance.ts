import { GameState, Stance, Tribute } from '../models/types';
import { ARCHETYPES } from '../data/archetypes';
import { FEAR, STANCE, STEALTH, VITALS } from '../data/balance';
import { SimContext } from './context';
import { cyclesSinceContact, ensureMemory } from './memory';
import { getRel } from './relationships';
import { fearOf } from './fear';
import { massOf } from './physique';

/** What a tribute can actually see of someone without knowing their sheet. */
function visiblePower(o: Tribute): number {
    // Frame, whether they are visibly holding something, and whether they are
    // visibly hurt. Not strength, not agility — those are numbers nobody in the
    // arena has access to.
    return 5
        + massOf(o) * 1.2
        + (o.inventory.some(i => i.type === 'weapon') ? 4 : 0)
        + o.health / 25
        - (o.injuries.bleeding ? 1.5 : 0)
        - (o.injuries.legs ? 1 : 0);
}

/**
 * Threat assessment: who else is standing here, and can I take them?
 *
 * Crucially, this is an *estimate*. The old version read `strength`, `agility`,
 * `health` and the full inventory straight off the live object, so every
 * tribute knew a total stranger's exact sheet on sight. Now they read what a
 * person can actually read — frame, visible weapon, visible wounds — corrected
 * by what they personally remember: a Career's reputation precedes them, and a
 * quiet survivalist gets underestimated, which is the whole point of both.
 *
 * Returns the ratio of hostile power to the tribute's own, allies included.
 */
export function assessZone(t: Tribute, occupants: Tribute[], state?: GameState) {
    const estimate = (o: Tribute) => {
        let power = visiblePower(o);
        // Reputation: a big training score is public, broadcast before the gong.
        if (o.trainingScore > 0) power += (o.trainingScore - 5) * 0.5;
        if (o.isCareer) power += 1.5;
        // Fear is its own multiplier on how dangerous someone looks.
        power += (fearOf(t, o.id) / FEAR.max) * 4;
        // Observation sharpens the estimate. Someone they fought yesterday is
        // read accurately; someone glimpsed across a clearing is a guess, and
        // the guess regresses toward "average tribute".
        if (state) {
            const staleness = cyclesSinceContact(state, t, o.id);
            if (staleness > 2) {
                const confidence = Math.max(0.35, 1 - Math.min(4, staleness) * 0.15);
                power = power * confidence + 8 * (1 - confidence);
            }
        }
        return power;
    };
    // A tribute knows their own capabilities exactly.
    const ownPower = (o: Tribute) => o.attributes.strength + o.attributes.agility
        + (o.inventory.some(i => i.type === 'weapon') ? 4 : 0) + o.health / 25;

    let hostile = 0;
    let friendly = 0;
    occupants.forEach(o => {
        if (o.id === t.id) return;
        const allied = t.allianceId !== undefined && t.allianceId === o.allianceId;
        const friend = allied || getRel(t, o.id) > 25;
        // You know what your own allies can do; strangers you have to guess at.
        if (friend) friendly += allied ? ownPower(o) : estimate(o);
        else hostile += estimate(o);
    });

    const own = ownPower(t) + friendly;
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
    const { ratio } = assessZone(t, occupants, ctx.state);
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
    // Bloodlust: a tribute who has just killed goes looking for the next one.
    scores.Aggressive += (t.momentum ?? 0) * 0.35;
    // Hunger is a reason to hunt, now that hunting actually feeds you.
    if (t.vitals.hunger > STANCE.huntingHunger) scores.Aggressive += 0.8;
    // The field narrowing is itself a reason to force the issue — somebody has
    // to, and the Gamemakers are going to make sure somebody does.
    const aliveCount = ctx.state.tributes.filter(o => o.status === 'alive').length;
    if (aliveCount <= STANCE.endgameFieldSize) scores.Aggressive += STANCE.endgameAggression;

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
