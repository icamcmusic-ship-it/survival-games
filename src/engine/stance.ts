import { GameState, Stance, Tribute } from '../models/types';
import { ARCHETYPES } from '../data/archetypes';
import { FEAR, STANCE, STANCE_MODES, STEALTH, VITALS } from '../data/balance';
import { STANCES, STANCE_PROFILES, isEvasiveStance } from '../data/stances';
import { SimContext } from './context';
import { cyclesSinceContact, ensureMemory, rivalRecord } from './memory';
import { getRel } from './relationships';
import { fearOf } from './fear';
import { massOf, visibleBulk } from './physique';
import { dreadOf, isCowed } from './intent';
import { traitMod } from '../data/traits';
import { profOf } from './proficiency';
import { hasBroken } from './resolve';
import { awareness } from './stealth';
import { getZone, reachableZones, zoneFeatures } from './map';
import { trapsIn } from './fieldcraft';
import { inventoryValue } from './items';

/**
 * What a tribute can actually see of someone without knowing their sheet.
 *
 * §1.6: this used to add `o.health / 25`, which leaked a hidden stat — a
 * tribute at 40 health with no visible bleeding read as measurably weaker than
 * one at 90, to an observer who has no way of knowing either number. It is now
 * a band ("they are visibly in a bad way") and the fine reading is gated on
 * actually being good at reading people.
 */
function visiblePower(o: Tribute, observer?: Tribute): number {
    let power = STANCE.visibleBase
        // §3.1: threat assessment at distance is mostly skeleton. A big frame
        // gone hollow still reads dangerous across a zone, which is exactly
        // the read `visibleBulk` encodes.
        + (massOf(o) + visibleBulk(o)) * STANCE.visibleMassWeight
        + (o.inventory.some(i => i.type === 'weapon') ? STANCE.visibleWeaponBonus : 0)
        - (o.injuries.bleeding ? STANCE.visibleBleedingPenalty : 0)
        - (o.injuries.legs ? STANCE.visibleLegPenalty : 0)
        // §3.6: a limp, or an arm held against the body. The grade layer knew
        // how badly somebody was hurt and nobody could see it — a favoured
        // limb is the most readable thing about a tribute at fifty yards, and
        // it is now a reason the field picks them.
        - (o.favouring ? STANCE.visibleFavouringPenalty : 0)
        // A scar reads the other way: whoever gave them that is not here.
        + (Object.keys(o.scars ?? {}).length > 0 ? STANCE.visibleScarBonus : 0);
    // Somebody in obvious trouble looks like somebody in obvious trouble.
    if (o.health < STANCE.visibleHurtHealth) power -= STANCE.visibleHurtPenalty;
    // A2: the Beast is the one archetype that wants to be underestimated on
    // paper and over-read on sight. Nothing in their file explains it; the
    // moment somebody actually looks at them, it does.
    if (o.archetype === 'beast') power += STANCE.beastVisibleBonus;
    // Eagle-Eyed, or simply paying attention: the fine reading is a skill.
    if (observer && awareness(observer) >= STANCE.visibleFineReadAwareness) {
        power += (o.health - STANCE.visibleHurtHealth) / STANCE.visibleFineReadDivisor;
    }
    return power;
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
        let power = visiblePower(o, t);
        // Reputation: a big training score is public, broadcast before the gong.
        if (o.trainingScore > 0) power += (o.trainingScore - STANCE.trainingScorePivot) * STANCE.trainingScoreWeight;
        if (o.isCareer) power += STANCE.careerVisibleBonus;
        // Fear is its own multiplier on how dangerous someone looks.
        power += (fearOf(t, o.id) / FEAR.max) * STANCE.fearVisibleWeight;
        // Deception. `trainingStrategy: 'conceal'` existed and had no in-arena
        // expression at all — a tribute who spent the whole pre-Games making
        // themselves look harmless was read exactly like everyone else the
        // moment the gong went. A concealer is systematically underestimated
        // until they give the game away: a kill is public (the cannon and the
        // sky announce it), and anyone who has actually traded blows with them
        // knows better whatever the training floor said.
        if (o.trainingStrategy === 'conceal' && o.kills === 0
            && rivalRecord(t, o.id).fights === 0) {
            power *= STANCE.concealDiscount;
        }
        // Observation sharpens the estimate. Someone they fought yesterday is
        // read accurately; someone glimpsed across a clearing is a guess, and
        // the guess regresses toward "average tribute".
        if (state) {
            const staleness = cyclesSinceContact(state, t, o.id);
            if (staleness > 2) {
                const confidence = Math.max(STANCE.staleConfidenceFloor,
                    1 - Math.min(4, staleness) * STANCE.staleConfidencePerCycle);
                power = power * confidence + STANCE.staleAveragePower * (1 - confidence);
            }
        }
        return power;
    };
    // A tribute knows their own capabilities exactly.
    const ownPower = (o: Tribute) => o.attributes.strength + o.attributes.agility
        + (o.inventory.some(i => i.type === 'weapon') ? STANCE.ownWeaponBonus : 0)
        + o.health / STANCE.ownHealthDivisor;

    let hostile = 0;
    let friendly = 0;
    occupants.forEach(o => {
        if (o.id === t.id) return;
        const allied = t.allianceId !== undefined && t.allianceId === o.allianceId;
        const friend = allied || getRel(t, o.id) > STANCE.friendRegardThreshold;
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
 * Everything the scoring table reads, computed once per tribute per cycle.
 *
 * Passing a signals bag rather than recomputing inside each scorer is what
 * makes the table cheap enough to be a table: eight rows that each re-derived
 * the threat ratio would run `assessZone` eight times.
 */
export interface StanceSignals {
    arch: typeof ARCHETYPES[keyof typeof ARCHETYPES];
    hasWeapon: boolean;
    ratio: number;
    hostile: number;
    wounded: boolean;
    aliveCount: number;
    occupants: Tribute[];
    /** Traps this tribute has set in the zone they are standing in. */
    ownTrapsHere: number;
    /** True when the ground itself rewards holding it. */
    chokepoint: boolean;
    elevation: boolean;
    /** A cannon fired in an adjacent zone this cycle or last. */
    cannonNearby: boolean;
    /** Someone hostile standing one zone over, and unaware of them. */
    shadowTarget?: Tribute;
    /** Total value of everything they are carrying. */
    kit: number;
    broken: boolean;
}

function buildSignals(ctx: SimContext, t: Tribute, occupants: Tribute[]): StanceSignals {
    const { ratio, hostile } = assessZone(t, occupants, ctx.state);
    const zone = getZone(ctx.state.arena, t.zone);
    const features = zone ? zoneFeatures(zone) : undefined;
    const cycle = ctx.state.cycle ?? 0;

    const neighbours = zone
        ? reachableZones(ctx.state.arena, t.zone, ctx.state.collapsedZones || []).map(z => z.name)
        : [];
    const cannonNearby = (ctx.state.recentCannonZones ?? [])
        .some(c => c.cycle >= cycle - 1 && (neighbours.includes(c.zone) || c.zone === t.zone));

    // Shadowing needs someone worth trailing: hostile, one zone over, and
    // currently unaware they are being trailed at all.
    let shadowTarget: Tribute | undefined;
    if (t.attributes.stealth >= STANCE_MODES.shadowing.stealthMin && (t.unseenStreak ?? 0) > 0) {
        const candidates = ctx.state.tributes.filter(o =>
            o.status === 'alive' && o.id !== t.id
            && (o.allianceId === undefined || o.allianceId !== t.allianceId)
            && neighbours.includes(o.zone));
        // Trail the one they already have a reason to watch, else the nearest
        // one they can plausibly stay behind.
        shadowTarget = candidates.find(o => t.shadowing?.targetId === o.id)
            ?? candidates.sort((a, b) => awareness(a) - awareness(b))[0];
    }

    return {
        arch: ARCHETYPES[t.archetype],
        hasWeapon: t.inventory.some(i => i.type === 'weapon'),
        ratio,
        hostile,
        wounded: t.injuries.bleeding || t.injuries.infected || t.injuries.poisoned,
        aliveCount: ctx.state.tributes.filter(o => o.status === 'alive').length,
        occupants,
        ownTrapsHere: trapsIn(ctx, t.zone).filter(tr => tr.ownerId === t.id).length,
        chokepoint: !!features?.chokepoint,
        elevation: !!features?.elevation,
        cannonNearby,
        shadowTarget,
        kit: inventoryValue(t),
        broken: hasBroken(t),
    };
}

type StanceScorer = (ctx: SimContext, t: Tribute, sig: StanceSignals) => number;

/**
 * Whether a conditional stance is even on the menu this cycle.
 *
 * This is the piece that keeps the expanded roster stable. Without it,
 * Fortified and Desperate would win a ranking on the cycle their situation
 * held and then immediately lose it again, and the hysteresis — which only
 * compares scores — has no way to tell "this stance is unavailable" from
 * "this stance scored badly".
 */
type StancePrecondition = (ctx: SimContext, t: Tribute, sig: StanceSignals) => boolean;

export const STANCE_PRECONDITIONS: Partial<Record<Stance, StancePrecondition>> = {
    Hunting: (_ctx, t) =>
        t.objective?.kind === 'hunt'
        && profOf(t, 'tracking') >= STANCE_MODES.hunting.trackingMin,

    // Ground they chose, held long enough to have worked on, with something
    // built on it. A trap is the purest version; a shelter counts too — the
    // point is that leaving costs them something they made.
    Fortified: (ctx, t, sig) => {
        if ((t.zoneHeld ?? 0) < STANCE_MODES.fortified.holdCycles) return false;
        // §8: the "something built" clause used to accept only a trap or a
        // finished shelter, and Fortified fired in one cycle in a thousand.
        // Measured funnel across 120 runs: 13.6% of alive-cycles have held the
        // same zone long enough, 23% of those are on a chokepoint or high
        // ground — and only 15% of *those* had a trap or a shelter, so the
        // stance was available in 0.48% of cycles before the score ranking
        // even looked at it. A fire and a camouflaged camp are work done on
        // ground too, and cost exactly the same thing to walk away from.
        // Defensible ground, or ground they have made defensible. Requiring
        // both was two rare gates in series: only 23% of long-held positions
        // are a chokepoint or high ground, and only 15% of *those* had
        // anything built on them, which put the stance's ceiling at 0.5% of
        // cycles before scoring. Either half is a real reason to stay put and
        // a real thing to lose by leaving.
        const camp = ctx.state.camps?.[t.id];
        return sig.chokepoint
            || sig.elevation
            || sig.ownTrapsHere > 0
            || camp?.shelter !== undefined
            || camp?.fire !== undefined
            || camp?.camouflage !== undefined;
    },

    // Sticky on the way out: a tribute who has been Desperate stays Desperate
    // until they are meaningfully clear of it, not the instant a bandage puts
    // them one point over the line. Without the exit band this is the single
    // worst thrashing source in the roster, because Desperate is (correctly)
    // exempt from both the minimum hold and the re-entry cooldown.
    Desperate: (_ctx, t, sig) => {
        const band = t.stance === 'Desperate' ? STANCE_MODES.desperate.exitBand : 1;
        return t.health < STANCE_MODES.desperate.healthThreshold * band
            || sig.broken
            || (t.vitals.hunger > STANCE_MODES.desperate.vitalThreshold / band
                && t.vitals.thirst > STANCE_MODES.desperate.vitalThreshold / band);
    },

    Scavenging: (_ctx, t, sig) => {
        // Same exit band: picking up one knife should not end a scavenging
        // run mid-sweep.
        const band = t.stance === 'Scavenging' ? STANCE_MODES.scavenging.exitBand : 1;
        return (!sig.hasWeapon && sig.kit < STANCE_MODES.scavenging.inventoryValue * band)
            || sig.cannonNearby;
    },

    // A trail already underway survives a cycle in which the quarry briefly
    // steps out of the adjacent sector — otherwise a shadow drops the stance
    // and its accumulated count every time their target crosses a boundary.
    Shadowing: (_ctx, t, sig) =>
        t.attributes.stealth >= STANCE_MODES.shadowing.stealthMin
        && (!!sig.shadowTarget || (t.stance === 'Shadowing' && !!t.shadowing))
        && (t.unseenStreak ?? 0) > 0,
};

/**
 * One scoring row per stance. Adding a ninth stance is a row here and a row in
 * `STANCE_PROFILES`, not a control-flow edit.
 */
export const STANCE_SCORERS: Record<Stance, StanceScorer> = {
    Aggressive: (ctx, t, sig) => {
        let s = 0;
        s += sig.arch.aggression * STANCE.archetypeWeight;
        // ...and the same state read from the other end: somebody cowed does
        // not go looking for anybody.
        if (isCowed(ctx, t)) s -= STANCE.cowedAggression;
        s += sig.hasWeapon ? STANCE.weaponAggression : -STANCE.weaponAggression;
        s += (t.health - STANCE.aggressiveHealth) / STANCE.aggressiveHealthDivisor;
        if (t.isCareer) s += STANCE.careerAggression;
        s += traitMod(t, 'aggressionScore');
        if (ensureMemory(t).vengeance.length > 0) s += STANCE.vengeanceAggression;
        if (sig.ratio > 0 && sig.ratio < STANCE.dominantRatio) s += STANCE.dominantAggression;
        // Bloodlust: a tribute who has just killed goes looking for the next
        // one. §3.2: weight trimmed — momentum stacking on top of the Career
        // and endgame bonuses had Aggressive at 43% of all cycles, and the
        // arena was flattening into a brawl.
        s += (t.momentum ?? 0) * STANCE.momentumAggressionWeight;
        // Hunger is a reason to hunt, now that hunting actually feeds you.
        if (t.vitals.hunger > STANCE.huntingHunger) s += STANCE.huntingHungerAggression;
        // The field narrowing is itself a reason to force the issue — somebody
        // has to, and the Gamemakers will make sure somebody does.
        if (sig.aliveCount <= STANCE.endgameFieldSize) s += STANCE.endgameAggression;
        s += sig.arch.stanceBias?.Aggressive ?? 0;
        return s;
    },

    Defensive: (ctx, t, sig) => {
        let s = STANCE.defensiveBase;
        s += STANCE.defensiveTemperament - Math.abs(sig.arch.aggression) - Math.abs(sig.arch.caution);
        if (t.allianceId) s += STANCE.allianceDefensive;
        // §3.2: Defensive was the least-seen stance despite being the most
        // tactically interesting. Give it the reasons it actually exists:
        // holding ground you have claimed, defending a camp you built,
        // standing over a ward you have sworn to protect.
        if (t.objective?.kind === 'protect') s += STANCE.protectDefensive;
        if (t.objective?.kind === 'hold') s += STANCE.holdDefensive;
        const camp = ctx.state.camps?.[t.id];
        if (camp && (camp.shelter !== undefined || camp.fire !== undefined)) s += STANCE.campDefensive;
        s += sig.arch.stanceBias?.Defensive ?? 0;
        return s;
    },

    Evasive: (ctx, t, sig) => {
        let s = 0;
        s += sig.arch.caution * STANCE.archetypeWeight;
        // §3.2: generalised fear. `memory.fear` is per-target and there was no
        // aggregate at all — a tribute could be frightened of every living
        // person and have no state that said so. Dread is not low resolve
        // ("I cannot keep doing this"); it is "there is nowhere in here that
        // is not one of them", and it changes the baseline rather than one
        // decision.
        s += dreadOf(ctx, t) * STANCE.dreadEvasive;
        s += (STANCE.evasiveHealth - t.health) / STANCE.evasiveHealthDivisor;
        if (sig.wounded) s += STANCE.woundedEvasive;
        if (!sig.hasWeapon) s += STANCE.unarmedEvasive;
        if (sig.ratio > STANCE.outmatchedRatio) s += STANCE.outmatchedEvasive;
        if (sig.arch.caution > STANCE.cautiousArchetypeThreshold && t.health < STANCE.cautiousEvasiveHealth) {
            s += STANCE.cautiousEvasive;
        }
        if (ctx.state.config.enableSanity && t.vitals.sanity < VITALS.breakdownThreshold) s += STANCE.lowSanityEvasive;
        // Someone who is genuinely good at disappearing reaches for it sooner
        // — but only slightly, or the whole cast goes to ground and nothing
        // happens.
        s += (t.attributes.stealth - STANCE.stealthPivot) * STANCE.stealthEvasiveWeight;
        s += sig.arch.stanceBias?.Evasive ?? 0;
        return s;
    },

    // ---- conditional stances ----

    Hunting: (ctx, t, sig) => {
        let s = STANCE_MODES.hunting.base;
        s += sig.arch.aggression * STANCE.archetypeWeight * STANCE_MODES.conditionalArchetypeWeight;
        s += profOf(t, 'tracking') * STANCE_MODES.hunting.perTrackingPoint;
        const quarry = t.objective?.kind === 'hunt' ? t.objective.targetId : undefined;
        if (quarry && ensureMemory(t).vengeance.includes(quarry)) s += STANCE_MODES.hunting.vengeanceBonus;
        if (sig.hasWeapon) s += STANCE.weaponAggression;
        // Somebody bleeding out does not run a manhunt.
        s -= Math.max(0, (STANCE.evasiveHealth - t.health) / STANCE.evasiveHealthDivisor);
        s += sig.arch.stanceBias?.Hunting ?? 0;
        return s;
    },

    Fortified: (ctx, t, sig) => {
        let s = STANCE_MODES.fortified.base;
        s += sig.ownTrapsHere * STANCE_MODES.fortified.perTrapBonus;
        if (ctx.state.camps?.[t.id]?.shelter !== undefined) s += STANCE.campDefensive;
        if (sig.chokepoint) s += STANCE_MODES.fortified.chokepointBonus;
        if (sig.elevation) s += STANCE_MODES.fortified.elevationBonus;
        if (t.objective?.kind === 'hold') s += STANCE.holdDefensive;
        if (t.objective?.kind === 'protect') s += STANCE.protectDefensive;
        if (t.allianceId) s += STANCE_MODES.fortified.alliedBonus;
        s += sig.arch.caution * STANCE.archetypeWeight * STANCE_MODES.conditionalArchetypeWeight;
        s += sig.arch.stanceBias?.Fortified ?? 0;
        return s;
    },

    Desperate: (ctx, t, sig) => {
        let s = STANCE_MODES.desperate.base;
        // The worse it is, the more total the commitment.
        s += Math.max(0, STANCE_MODES.desperate.healthThreshold - t.health) * STANCE_MODES.desperate.perTenHealthBelow / 10;
        if (sig.broken) s += STANCE_MODES.desperate.brokenBonus;
        if (t.vitals.hunger > STANCE_MODES.desperate.vitalThreshold) s += STANCE_MODES.desperate.vitalBonus;
        if (t.vitals.thirst > STANCE_MODES.desperate.vitalThreshold) s += STANCE_MODES.desperate.vitalBonus;
        s += sig.arch.stanceBias?.Desperate ?? 0;
        return s;
    },

    Scavenging: (ctx, t, sig) => {
        let s = STANCE_MODES.scavenging.base;
        if (!sig.hasWeapon) s += STANCE_MODES.scavenging.unarmedBonus;
        if (sig.cannonNearby) s += STANCE_MODES.scavenging.cannonBonus;
        s += Math.max(0, STANCE_MODES.scavenging.inventoryValue - sig.kit) * STANCE_MODES.scavenging.perMissingValue;
        // Walking onto a fresh cannon site with people still standing on it is
        // a different decision entirely.
        if (sig.ratio > STANCE.outmatchedRatio) s -= STANCE_MODES.scavenging.contestedPenalty;
        s += sig.arch.stanceBias?.Scavenging ?? 0;
        return s;
    },

    Shadowing: (ctx, t, sig) => {
        let s = STANCE_MODES.shadowing.base;
        s += (t.attributes.stealth - STANCE_MODES.shadowing.stealthMin) * STANCE_MODES.shadowing.perStealthPoint;
        // Already mid-trail: finishing what you started beats restarting it.
        if (t.shadowing?.targetId === sig.shadowTarget?.id) s += (t.shadowing?.cycles ?? 0) * STANCE_MODES.shadowing.perTrailCycle;
        if (sig.hasWeapon) s += STANCE_MODES.shadowing.armedBonus;
        if (sig.wounded) s -= STANCE_MODES.shadowing.woundedPenalty;
        s += sig.arch.stanceBias?.Shadowing ?? 0;
        return s;
    },
};

/**
 * Stance selection with hysteresis.
 *
 * Stance is scored — including who else is in the zone — and a challenger has
 * to clearly beat the incumbent to take over. Without the hold, a tribute
 * hovering near a health threshold flips between two stances on alternate
 * cycles forever.
 *
 * A1: the hold is now gated per stance rather than globally. Desperate is an
 * emergency (`minHold: 0`), Fortified is a commitment (`minHold: 3`), and a
 * conditional stance whose precondition has lapsed is dropped immediately
 * whatever the hold says — a tribute who healed past 25 health is not still
 * Desperate for two more cycles.
 */
/**
 * §1.7: a stance imposed by an event rather than chosen by the scorer.
 *
 * Combat forces Evasive when somebody breaks off, vengeance forces Aggressive
 * when somebody watches a friend die, and a resolve collapse forces Defensive.
 * All three wrote `t.stance` directly, which meant they bypassed every piece of
 * the hysteresis machinery — and they are the actual source of the surviving
 * thrash: a vengeful tribute in a running fight alternated Aggressive/Evasive
 * on every cycle, one forced set each way, with the scorer never consulted.
 *
 * Forced changes stay authoritative (they are story beats, not noise), but they
 * now count toward churn like any other change, and a tribute who is already
 * being whipsawed is left where they are. Somebody who has flipped three times
 * in four cycles is not going to be talked into a fourth by the same fight.
 */
export function forceStance(t: Tribute, stance: Stance) {
    if (t.stance === stance) { t.stanceHeld = 0; return; }
    if ((t.stanceChurn ?? 0) >= STANCE.churnMax) return;
    t.stance = stance;
    t.stanceHeld = 0;
    t.stanceChurn = Math.min(STANCE.churnMax, (t.stanceChurn ?? 0) + 1);
}

export function updateStance(ctx: SimContext, t: Tribute, occupants: Tribute[]) {
    const sig = buildSignals(ctx, t, occupants);
    // Churn decays every cycle a tribute is scored, so the widened margin is a
    // brake on oscillation rather than a permanent tax on ever changing again.
    t.stanceChurn = Math.max(0, (t.stanceChurn ?? 0) - STANCE.churnDecayPerCycle);

    const cycle = ctx.state.cycle ?? 0;
    const ready = { ...(t.stanceReady ?? {}) };
    const available = STANCES.filter(s => {
        const pre = STANCE_PRECONDITIONS[s];
        if (!pre) return true;
        if (!pre(ctx, t, sig)) return false;
        // The situation holds. Record that, and note whether it also held last
        // cycle — entry latency is the mirror of the exit cooldown and is what
        // stops a one-cycle flicker (a cannon two zones over, a quarry
        // stepping briefly out of the next sector) yanking a tribute out of
        // what they were doing and straight back again.
        const heldLastCycle = (t.stanceReady?.[s] ?? -Infinity) >= cycle - 1;
        ready[s] = cycle;
        // Staying where they are needs no latency, and Desperate is an
        // emergency: it is never delayed and never locked out.
        if (s === t.stance || s === 'Desperate') return true;
        if (!heldLastCycle) return false;
        return (t.stanceCooldown?.[s] ?? -Infinity) <= cycle;
    });
    t.stanceReady = ready;

    const scores = Object.fromEntries(
        available.map(s => [s, STANCE_SCORERS[s](ctx, t, sig)])
    ) as Record<Stance, number>;

    // Trailing is a per-cycle commitment; drop it the moment the stance does.
    if (available.includes('Shadowing') && sig.shadowTarget) {
        t.shadowing = t.shadowing?.targetId === sig.shadowTarget.id
            ? t.shadowing
            : { targetId: sig.shadowTarget.id, cycles: 0 };
    } else if (t.stance !== 'Shadowing') {
        t.shadowing = undefined;
    }

    const ranked = (Object.entries(scores) as Array<[Stance, number]>).sort((a, b) => b[1] - a[1]);
    const [bestStance, bestScore] = ranked[0] ?? ['Defensive', 0];

    // A conditional stance whose situation has passed is vacated at once — the
    // hold is a stability device, not a trap.
    const stillValid = available.includes(t.stance);

    if (bestStance === t.stance) {
        t.stanceHeld += 1;
        if (t.stance === 'Fortified') t.fortifiedCycles = (t.fortifiedCycles ?? 0) + 1;
        return;
    }

    // A genuine emergency overrides the *hold*: nobody stands their ground
    // bleeding out waiting for a minimum-cycles counter.
    const emergency = t.health < STANCE.evasiveHealth * STANCE.emergencyHealthFactor
        || sig.ratio > STANCE.outmatchedRatio * STANCE.emergencyRatioFactor
        || !stillValid;

    // §1.7: churn extends the hold as well as the margin. Aggressive/Evasive
    // is the pair that survived the score-only hysteresis, because a rival
    // stepping in and out of the zone genuinely swings both scores by more
    // than any fixed margin — the gap is real, it is just re-litigated every
    // cycle. The answer to that is commitment, not a bigger threshold: a
    // tribute who has already changed their mind twice holds what they have
    // for an extra cycle unless they are actually in danger.
    const hold = (STANCE_PROFILES[t.stance]?.minHold ?? STANCE.minHold)
        + Math.floor((t.stanceChurn ?? 0) * STANCE.churnHoldPerSwitch);
    if (!emergency && t.stanceHeld < hold) {
        t.stanceHeld += 1;
        return;
    }
    // ...but it does *not* override the switch margin, which is the part that
    // stops oscillation rather than the part that stops responsiveness. It used
    // to skip both, so a badly hurt tribute — permanently in "emergency" by
    // definition — had no hysteresis at all and flipped between two near-equal
    // scorers every single cycle for the rest of their short life. The margin
    // is skipped only when the incumbent stance is no longer available, where
    // there is no incumbent score to compare against.
    // §1.7: the margin widens with recent churn. A tribute who has changed
    // stance twice in the last few cycles is, by revealed behaviour, sitting
    // between two near-equal scorers — and the right answer there is to make
    // the third change genuinely expensive rather than to keep letting the
    // noise win. Decayed below, so a settled tribute pays nothing for it.
    const margin = STANCE.switchMargin * (1 + (t.stanceChurn ?? 0) * STANCE.churnMarginPerSwitch);
    if (stillValid && bestScore < (scores[t.stance] ?? -Infinity) + margin) {
        t.stanceHeld += 1;
        return;
    }

    // Leaving a conditional stance locks it out for a few cycles, so a
    // flickering precondition cannot bounce a tribute back into it next turn.
    if (STANCE_PROFILES[t.stance]?.conditional) {
        t.stanceCooldown = { ...(t.stanceCooldown ?? {}), [t.stance]: cycle + STANCE.conditionalCooldown };
    }
    t.stance = bestStance;
    t.stanceHeld = 0;
    t.stanceChurn = Math.min(STANCE.churnMax, (t.stanceChurn ?? 0) + 1);
    if (bestStance !== 'Fortified') t.fortifiedCycles = 0;
    if (!isEvasiveStance(bestStance) && bestStance !== 'Shadowing') t.shadowing = undefined;
}
