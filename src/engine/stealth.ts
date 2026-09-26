import { scarCoverShift, weatherConcealment } from './arenaDepth';
import { profOf, trainProficiency } from './proficiency';
import { Tribute, Zone } from '../models/types';
import { zoneFeatures } from './map';
import { AUDIT12_WAVE2_TRIBUTES, CRAFTING, INVENTORY, PROFICIENCY, STANCE_MODES, STEALTH } from '../data/balance';
import { ambushSkillShift, lureAmbushBonus } from './traitHooks';
import { SimContext, getAlive } from './context';
import { traitMod } from '../data/traits';
import { concealmentModifier, effectiveIntelligence } from './physique';
import { encumbranceOf, hasTool } from './items';
import { isAggressiveStance, isEvasiveStance } from '../data/stances';
import { allied } from './alliance';
import { acousticsConcealmentShift, sightlineAmbush, sightlineConcealment, arenaIsDark } from './arenaRules';
import { MUTATOR_TUNING, hasMutator } from '../data/mutators';

/**
 * Concealment and awareness — the two halves of whether one tribute ever finds
 * out the other is there.
 *
 * Every read of `stealth` outside the scripted hazard dodges lives here, so a
 * high-stealth tribute is genuinely harder to corner and genuinely more
 * dangerous when they choose to open a fight.
 */


/**
 * Whether it is currently dark, and whether this particular tribute cares.
 *
 * REPLAY-07: the night was mechanically almost identical to the day. It is now
 * the single biggest situational modifier in the concealment system — but not
 * for everyone. A lantern buys back the sight and costs the cover; the
 * Night-Sighted trait buys back the sight and keeps the cover, which is most of
 * what that trait is for.
 */
function isDark(ctx: SimContext): boolean {
    // Generic arena rule: an arena-wide sightline (lights up, blackout,
    // whiteout) overrides the clock. Centralised in engine/arenaRules.ts.
    return arenaIsDark(ctx.state);
}

/** Half-light: enough to move by, not enough to hide in. */
function isTwilight(ctx: SimContext): boolean {
    return ctx.state.timeOfDay === 'dusk';
}

/** How well a tribute is hidden in the ground they are standing on, 0-1. */
export function concealment(
    t: Tribute,
    zone: Zone | undefined,
    alliesPresent: number,
    camp?: { fire?: boolean; camouflage?: boolean },
    dark = false,
): number {
    let value = STEALTH.baseConcealment;

    // §(requests, deferred): the skill of not being seen. A tribute who has
    // spent a week successfully hiding is better at it than one who has not,
    // which is the whole reason a proficiency exists — and `stealth` was the
    // one subsystem in the engine with an attribute, a full model and nothing
    // that got better by doing it.
    value += profOf(t, 'stealth') * STEALTH.proficiencyScale;

    // The dark hides everybody, unless they are carrying the reason it doesn't.
    if (dark && !hasTool(t, 'light')) value += STEALTH.nightConcealment;

    if (isEvasiveStance(t.stance)) value += STEALTH.evasiveBonus;
    if (isAggressiveStance(t.stance)) value -= STEALTH.aggressivePenalty;
    // A1: the conditional stances trade cover for their own payoffs. A hunter
    // crossing ground toward a named target is not being careful about it; a
    // shadow is doing nothing else *but* being careful about it.
    if (t.stance === 'Hunting') value -= STANCE_MODES.hunting.concealmentPenalty;
    if (t.stance === 'Shadowing') value += STANCE_MODES.shadowing.concealmentBonus;
    if (t.stance === 'Desperate') value -= STANCE_MODES.desperate.concealmentPenalty;
    /*
     * AUDIT-7 §12.6: Baiting gives it away on purpose, which is the whole
     * stance. It is the only row here where the tribute *wants* the number
     * lower, and it is only available on ground they have already trapped or
     * hold a chokepoint on — so the concealment is being spent rather than
     * lost.
     */
    if (t.stance === 'Baiting') value -= STANCE_MODES.baiting.concealmentCost;
    // ...and Tending is standing still with both hands busy, which is the
    // opposite trade and roughly the same size.
    if (t.stance === 'Tending') value += STANCE_MODES.tending.concealmentBonus;
    // AUDIT-12 §16: Hiding is going to ground on purpose.
    if (t.stance === 'Hiding') value += AUDIT12_WAVE2_TRIBUTES.hidingConcealmentBonus;

    // A fire is warmth, hot food and a beacon. Camouflage is the reverse trade.
    if (camp?.fire) value -= CRAFTING.fireConcealmentPenalty;
    if (camp?.camouflage) {
        // §6.5: camouflage is imitation, and the zone decides how much there
        // is to imitate — full value in deep forest, next to nothing on open
        // salt or standing water.
        const coverScale = zone
            ? Math.max(0.2, 1 + (zoneFeatures(zone).cover - CRAFTING.camouflageCoverPivot) * CRAFTING.camouflageCoverWeight)
            : 1;
        // ...and how well it was put on. `camouflage` is the skill half of the
        // same trade: the ground decides how much there is to imitate, the
        // tribute decides how much of it they actually managed to imitate.
        value += (CRAFTING.camouflageConcealment
            + profOf(t, 'camouflage') * PROFICIENCY.camouflageConcealmentPerLevel) * coverScale;
    }

    if (zone) {
        // §5.2: graded cover from the zone's interior, replacing the old
        // binary terrain check — a sparse ruin hides less than deep forest.
        const f = zoneFeatures(zone);
        value += (f.cover - 0.35) * STEALTH.coverGradeScale;
        // §5.2: acoustics, as shared surface rather than one arena's gimmick.
        // Ground that throws sound around (a canyon, a vault, a bare gallery)
        // gives a hider away; ground that swallows it hides them further.
        value -= ((f.acoustics ?? 1) - 1) * STEALTH.acousticsScale;
    }

    if (t.injuries.bleeding) value -= STEALTH.bleedingPenalty;
    // §3.3: a full pack is a loud pack.
    value -= encumbranceOf(t) * INVENTORY.encumbranceStealthPenaltyMax;
    // §3.1: a big frame is a big thing to put behind a rock. Skeleton, not
    // soft tissue — starving down does not make you smaller across the
    // shoulders, which is the whole point of splitting the two axes.
    value += concealmentModifier(t) * STEALTH.coverGradeScale;
    // Traits that change how well someone disappears into the ground.
    value += traitMod(t, 'concealment');
    if (hasTool(t, 'light')) value -= STEALTH.lightConcealmentPenalty;
    // A group leaves a group's worth of tracks.
    value -= Math.min(3, alliesPresent) * STEALTH.groupPenalty;

    return value;
}

/** How good a tribute is at spotting someone who does not want to be spotted. */
export function awareness(t: Tribute, dark = false): number {
    // §3.3: `effectiveIntelligence`, not the printed number. Judgement is the
    // first thing a fourth night without sleep takes, and watching a treeline
    // properly is judgement — the sleep-debt system already charged for it in
    // dropped kit and missed forage but never in the attribute it was actually
    // impairing.
    let value = effectiveIntelligence(t) * STEALTH.awarenessFromIntelligence;

    // You cannot watch a treeline you cannot see. A light or the right eyes
    // give it back; the trait's own awareness bonus stacks on top.
    if (dark && !hasTool(t, 'light') && !t.traits.includes('Night-Sighted')) {
        value -= STEALTH.nightAwarenessPenalty;
    }

    /*
     * The watching half of the system. AUDIT-7 gave `stealth` — hiding — a
     * proficiency and left the other side of every one of those rolls reading
     * intelligence and a trait mod, so a lookout who had caught people out of
     * a treeline all week was no better at it than somebody who had spent the
     * week asleep. `isNoticed` trains it on both outcomes.
     */
    value += profOf(t, 'vigilance') * PROFICIENCY.vigilanceAwarenessWeight;
    value += traitMod(t, 'awareness');
    // §8c: awareness that only exists after dark. An insomniac is not a better
    // lookout at noon; they are simply the one who is still awake at three.
    if (dark) value += traitMod(t, 'awarenessNight');
    // A hunter is looking; someone hiding in a bush is not.
    if (isAggressiveStance(t.stance)) value += STEALTH.aggressiveAwareness;
    if (isEvasiveStance(t.stance)) value -= STEALTH.evasiveAwareness;
    // A1: a hunter is looking for exactly one person and finds them; a tribute
    // past caring has stopped watching anything but the next few feet.
    if (t.stance === 'Hunting') value += STANCE_MODES.hunting.awarenessBonus;
    if (t.stance === 'Desperate') value -= STANCE_MODES.desperate.awarenessPenalty;

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
    if (allied(hider, seeker)) return true;

    const dark = isDark(ctx);
    const advantage = hider.attributes.stealth - awareness(seeker, dark);
    // A fire gives a hider away and camouflage hides them further; both are
    // choices they made on an earlier turn, which is what makes them tactics.
    const cycle = ctx.state.cycle ?? 0;
    const camp = ctx.state.camps?.[hider.id];
    let hidden0 = concealment(hider, zone, alliesPresent, {
        fire: camp?.fire !== undefined && cycle < camp.fire,
        camouflage: camp?.camouflage !== undefined && cycle < camp.camouflage,
    }, dark);
    // Half-light: some of the night's cover, none of its safety.
    if (isTwilight(ctx) && !hasTool(hider, 'light')) hidden0 += STEALTH.duskConcealment;
    // AUDIT-11 §12 `blind-night`: the dark is total, torch or not.
    if (dark && hasMutator(ctx.state.config, 'blind-night')) hidden0 += MUTATOR_TUNING.blindNightConcealment;
    // Generic arena rules: the soundscape and sightline move how much the
    // ground gives a hider away (arenaRules.ts; neutral when unset).
    hidden0 += acousticsConcealmentShift(ctx.state, zone);
    // AUDIT-11 §7: the weather layer and the ground's scars (arenaDepth.ts).
    hidden0 += weatherConcealment(ctx.state, seeker) + scarCoverShift(ctx.state, hider.zone);
    hidden0 *= sightlineConcealment(ctx.state);
    let hidden = Math.min(
        STEALTH.maxConcealment,
        Math.max(0, hidden0 + advantage * STEALTH.perPointAdvantage)
    );

    // The Gamemakers close the arena down rather than let the last few tributes
    // hide from each other forever — without this, two Evasive tributes with
    // good stealth in the final zone simply never meet and the Games never end.
    hidden *= endgameVisibility(ctx);

    const noticed = ctx.rng.chance(hidden);
    /*
     * AUDIT-7 §3.5: `stealth` had no `trainProficiency` call site at all.
     *
     * Its peak across 6,000 tributes was 1.00 — the value everybody starts at —
     * in a game with a `ghost` archetype, this whole module, an `ambush`
     * modifier and 965 measured ambushes per 400 runs. The skill existed on the
     * sheet and nothing in the arena could move it.
     *
     * Getting away with it is the lesson; being seen is a smaller one, which is
     * exactly what `share` is for. Gated on a real attempt — allies are not
     * hiding from each other and the function returns above for them — so this
     * is once per seeker who might have found them.
     */
    if (!noticed) trainProficiency(hider, 'stealth');
    else trainProficiency(hider, 'stealth', undefined, PROFICIENCY.stealthCaughtShare);
    // The same roll from the other side. Finding somebody is the lesson;
    // scanning ground and finding nothing in it is the smaller one, and it is
    // the one that happens constantly, which is what keeps the axis moving.
    if (noticed) trainProficiency(seeker, 'vigilance');
    else trainProficiency(seeker, 'vigilance', undefined, PROFICIENCY.vigilanceWatchShare);
    // Paint that worked is the only evidence that the paint works.
    if (!noticed && camp?.camouflage !== undefined && cycle < camp.camouflage) {
        trainProficiency(hider, 'camouflage', undefined, PROFICIENCY.camouflageUnseenShare);
    }
    return !noticed;
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
    if (allied(attacker, defender)) return false;
    // A1: Fortified is prepared ground with sightlines its occupant chose.
    // Nobody surprises them on it — that is the whole reason to dig in.
    if (defender.stance === 'Fortified') return false;

    const dark = isDark(ctx);
    const advantage = attacker.attributes.stealth - awareness(defender, dark);
    let chance = STEALTH.ambushBase + advantage * STEALTH.ambushPerPointAdvantage;

    // Night is when an ambush is an ambush. This is the whole reason a hunter
    // waits for dark rather than forcing a fight at noon.
    if (dark && !hasTool(defender, 'light')) chance += STEALTH.nightAmbushBonus;
    if (dark && hasMutator(ctx.state.config, 'blind-night')) chance += MUTATOR_TUNING.blindNightAmbush;
    // Dusk is the hunter's window, and the best one they get: their quarry is
    // on the move and there is still enough light to line them up. Full dark
    // favours the hider; half-light favours whoever is already watching.
    if (isTwilight(ctx)) chance += STEALTH.duskAmbushBonus;
    chance += sightlineAmbush(ctx.state);

    if (zone) {
        const f = zoneFeatures(zone);
        // §5.2: cover conceals the ambusher; high ground shows them coming;
        // a chokepoint is where you wait for someone.
        chance += (f.cover - 0.35) * STEALTH.coverGradeScale * 0.8;
        if (f.elevation) chance -= STEALTH.elevationAmbushPenalty;
        if (f.chokepoint) chance += STEALTH.chokepointAmbushBonus;
    }
    if (attacker.archetype === 'trickster') chance += STEALTH.tricksterAmbushBonus;
    // A1: a hunter has been reading this specific person's movements.
    if (attacker.stance === 'Hunting') chance += STANCE_MODES.hunting.ambushBonus;
    // Audit 2 §1.6/§10.1: somebody who decided to sit on this ground and wait
    // for whoever came through it.
    //
    // The `wait` objective described itself as "sitting on a chokepoint
    // precisely because everyone else has to come through it" and then did
    // nothing whatsoever: `objectiveHolds` lumped it in with `hold` and the two
    // were mechanically the same instruction, "do not move". An intention with
    // no payoff is not an intention, and making `wait` merely *reachable*
    // without one just converted fights into standing still — it moved
    // victors-with-zero-kills from 31.9% to 32.2% and tripped that guard.
    //
    // This is the payoff, and it is the only one it needs: the person who chose
    // the ground gets to open on the person who walked onto it.
    if (attacker.objective?.kind === 'wait' && attacker.objective.zone === attacker.zone) {
        chance += STEALTH.waitingAmbushBonus;
    }
    chance += traitMod(attacker, 'ambush');
    // AUDIT-12 T15 / §16: a Mimic's lure, the Ambush skill, and a Scout-Runner's warning.
    chance += lureAmbushBonus(ctx, attacker, defender) + ambushSkillShift(ctx, attacker, defender);
    if (isAggressiveStance(defender.stance)) chance -= 0.1;

    return ctx.rng.chance(Math.max(0, Math.min(STEALTH.maxAmbushChance, chance)));
}
