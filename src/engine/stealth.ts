import { Terrain, Tribute, Zone } from '../models/types';
import { CRAFTING, STEALTH } from '../data/balance';
import { SimContext, getAlive } from './context';
import { traitMod } from '../data/traits';
import { hasTool } from './items';

/**
 * Concealment and awareness — the two halves of whether one tribute ever finds
 * out the other is there.
 *
 * Every read of `stealth` outside the scripted hazard dodges lives here, so a
 * high-stealth tribute is genuinely harder to corner and genuinely more
 * dangerous when they choose to open a fight.
 */

const COVER_TERRAIN: Terrain[] = ['forest', 'ruins', 'wetland'];

/** How well a tribute is hidden in the ground they are standing on, 0-1. */
export function concealment(
    t: Tribute,
    zone: Zone | undefined,
    alliesPresent: number,
    camp?: { fire?: boolean; camouflage?: boolean },
): number {
    let value = STEALTH.baseConcealment;

    if (t.stance === 'Evasive') value += STEALTH.evasiveBonus;
    if (t.stance === 'Aggressive') value -= STEALTH.aggressivePenalty;

    // A fire is warmth, hot food and a beacon. Camouflage is the reverse trade.
    if (camp?.fire) value -= CRAFTING.fireConcealmentPenalty;
    if (camp?.camouflage) value += CRAFTING.camouflageConcealment;

    if (zone) {
        if (COVER_TERRAIN.includes(zone.terrain)) value += STEALTH.coverBonus;
        if (zone.terrain === 'open') value -= STEALTH.openPenalty;
    }

    if (t.injuries.bleeding) value -= STEALTH.bleedingPenalty;
    // Traits that change how well someone disappears into the ground.
    value += traitMod(t, 'concealment');
    if (hasTool(t, 'light')) value -= STEALTH.lightConcealmentPenalty;
    // A group leaves a group's worth of tracks.
    value -= Math.min(3, alliesPresent) * STEALTH.groupPenalty;

    return value;
}

/** How good a tribute is at spotting someone who does not want to be spotted. */
export function awareness(t: Tribute): number {
    let value = t.attributes.intelligence * STEALTH.awarenessFromIntelligence;

    value += traitMod(t, 'awareness');
    // A hunter is looking; someone hiding in a bush is not.
    if (t.stance === 'Aggressive') value += 1.5;
    if (t.stance === 'Evasive') value -= 1;

    // A light in your hand is the difference between watching the treeline and
    // guessing at it — and it is the reason everyone else can see you.
    if (hasTool(t, 'light')) value += STEALTH.lightAwarenessBonus;

    if (t.vitals.fatigue > 80) value -= STEALTH.exhaustedPenalty;
    if (t.vitals.sanity < 30) value -= STEALTH.lowSanityPenalty;

    return value;
}

/**
 * Whether `seeker` notices `hider` sharing a zone with them. A tribute nobody
 * notices simply does not have an encounter this cycle — which is what makes
 * hiding a real strategy rather than a flavour line.
 */
export function isNoticed(ctx: SimContext, hider: Tribute, seeker: Tribute, zone: Zone | undefined, alliesPresent: number): boolean {
    // Allies are not hiding from each other.
    if (hider.allianceId !== undefined && hider.allianceId === seeker.allianceId) return true;

    const advantage = hider.attributes.stealth - awareness(seeker);
    // A fire gives a hider away and camouflage hides them further; both are
    // choices they made on an earlier turn, which is what makes them tactics.
    const cycle = ctx.state.cycle ?? 0;
    const camp = ctx.state.camps?.[hider.id];
    const hidden0 = concealment(hider, zone, alliesPresent, {
        fire: camp?.fire !== undefined && cycle < camp.fire,
        camouflage: camp?.camouflage !== undefined && cycle < camp.camouflage,
    });
    let hidden = Math.min(
        STEALTH.maxConcealment,
        Math.max(0, hidden0 + advantage * STEALTH.perPointAdvantage)
    );

    // The Gamemakers close the arena down rather than let the last few tributes
    // hide from each other forever — without this, two Evasive tributes with
    // good stealth in the final zone simply never meet and the Games never end.
    hidden *= endgameVisibility(ctx);

    return !ctx.rng.chance(hidden);
}

/** Multiplier on concealment as the field narrows: 1 early, 0 at the end. */
export function endgameVisibility(ctx: SimContext): number {
    const remaining = getAlive(ctx.state).length;
    if (remaining > STEALTH.endgameRevealAt) return 1;
    return Math.max(0, (remaining - 1) * STEALTH.endgameConcealmentStep);
}

/**
 * Whether `attacker` opens the fight from cover. An ambush buys a free hit at
 * increased damage and a power edge in the first exchange — the difference
 * between a knife-fight and an execution.
 */
export function rollAmbush(ctx: SimContext, attacker: Tribute, defender: Tribute, zone: Zone | undefined): boolean {
    // You cannot ambush someone who is already fighting you, or an ally.
    if (attacker.allianceId !== undefined && attacker.allianceId === defender.allianceId) return false;

    const advantage = attacker.attributes.stealth - awareness(defender);
    let chance = STEALTH.ambushBase + advantage * STEALTH.ambushPerPointAdvantage;

    if (zone && COVER_TERRAIN.includes(zone.terrain)) chance += STEALTH.coverBonus;
    if (zone && zone.terrain === 'open') chance -= STEALTH.openPenalty;
    if (attacker.archetype === 'trickster') chance += 0.12;
    chance += traitMod(attacker, 'ambush');
    if (defender.stance === 'Aggressive') chance -= 0.1;

    return ctx.rng.chance(Math.max(0, Math.min(STEALTH.maxAmbushChance, chance)));
}
