import { arenaHasLaw } from './gamesProfile';
import { targetDrawOf } from './targeting';
import { DamageRecord, Item, Tribute, attr } from '../models/types';
import { forceStance } from './stance';
import { SimContext } from './context';
import { WEAPON_KILL_TEMPLATES, DEATH_TEXTS, DUEL_TEXTS, GROUP_COMBAT_TEXTS } from '../data/flavorText';
import { ARCHETYPES } from '../data/archetypes';
import { dissolveBrokeredTruces, effectiveCaution } from './archetypeHooks';
import { ARCHETYPE_HOOKS, ARENA_DEATH_BUDGET, BLEEDING, RELATIONSHIPS as REL_KNOBS, COMBAT, DEBTS, DOWNED, EARNED_TRAIT_RULES, ESCALATION, FEAR, HUNTING, INVENTORY, LOOTING, MEMORY, NOTORIETY, INJURY_BEHAVIOUR, PROFICIENCY, QUALITY, RISK, SHOCK, QUELL_MECHANICS, RIVALRY, STANCE_MODES, STEALTH, SOCIAL_AXES, UNIVERSAL_DEATHS, ARENA_LAWS } from '../data/balance';
import { goDown, isActive, isDowned } from './downed';
import { clampTribute } from './vitals';
import { enforceCapacity, giveItem } from './items';
import { rollAmbush } from './stealth';
import { getZone, zoneFeatures } from './map';
import { loadFromViolence } from './loadBearing';
import { bloodOnTheBlade } from './legendaryItems';
import { noteFightOpened } from './runRecords';
import { displayName } from './epithets';
import { readOf, addZoneThreat, broadcastDeath, cycleOf, ensureMemory, hasVengeanceAgainst, noteContact, noteFight, noteFled, noteStoodBy, noteWound, rattle } from './memory';
import { classifyCause } from './causes';
import { incurDebt } from './debts';
import { adjustRel, adjustTrust, getRel, propagateDeathFallout } from './relationships';
import { injure, injuryGrade, openWound } from './wounds';
import { isUnfamiliar, noteWeaponUse, profOf, trainProficiency, weaponAffinity, weaponHandling, weaponProficiency } from './proficiency';
import { addFear, fearFraction, reduceFear } from './fear';
import { notorietyFraction, witnessReputation } from './notoriety';
import { areLovers, emptyCache } from './alliance';
import { hasTruce } from './parley';
import { riskTolerance } from './risk';
import { blocTreatyHolds, noteBlocKill } from './blocTreaty';
import { dominantSideCost, effectiveAgility, grappleResistance, injuryAbsorption, reachBonus } from './physique';
import { addExcitement } from './audience';
import { traitMod } from '../data/traits';
import { earnTrait } from './earnedTraits';
import { PREGAMES } from '../data/balance';
import { armourOf, effectiveDamage, encumbranceOf, wearArmour } from './items';
import { isAggressiveStance, isEvasiveStance } from '../data/stances';
import { loseSanity } from './sanityBands';
import { composureOf } from './composure';

const fill = (template: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((text, [k, v]) => text.split(`{${k}}`).join(v), template);

/**
 * CONTENT-05: which pool of environmental death prose fits this particular
 * death. Priority order matters — a fan-favourite twelve-year-old dying alone
 * is a child death first, everything else is colour on top of it.
 */
function pickEnvironmentalDeathPool(victim: Tribute, witness: Tribute | undefined) {
    if (victim.age <= PREGAMES.childAge) return DEATH_TEXTS.environmentalChild;
    if (victim.fanFavourite) return DEATH_TEXTS.environmentalFanFavourite;
    if (witness) return DEATH_TEXTS.environmentalWitnessed;
    if (victim.isCareer) return DEATH_TEXTS.environmentalCareer;
    return DEATH_TEXTS.environmentalAlone;
}

/** Damage kinds a worn piece of armour can actually do anything about. */
const ARMOURED_DAMAGE: DamageRecord['kind'][] = ['tribute', 'mutt', 'hazard', 'arena', 'gamemaker'];

/**
 * §9.1: wounds that leave a body somebody could still reach in time.
 *
 * Thirst and starvation are excluded on purpose — there is no rescue fiction
 * in an ally arriving to find someone who has run out of water two days ago,
 * and a downed window there would only be a delay dressed up as a scene.
 */
const DOWNABLE_DAMAGE: DamageRecord['kind'][] = ['tribute', 'mutt', 'arena', 'hazard'];

/**
 * §9.1: the killing blow, resolved as either a cannon or a window.
 *
 * Every combat path used to call `killTribute` directly the moment health hit
 * zero, bypassing `checkDeath` entirely — so hooking `checkDeath` alone would
 * have left the mercy unreachable from the one place it most belongs. This is
 * the same decision `checkDeath` makes, with the weapon prose kept intact for
 * the deaths that still land.
 */
function strikeDown(ctx: SimContext, victim: Tribute, killer: Tribute, weapon?: Item) {
    // §4.1: if their two groups had an agreement, this ends it for everybody
    // on both sides at once.
    noteBlocKill(ctx, killer, victim);
    // §3.4: a blow landed on somebody who was already finished is a choice, and
    // it is the one the Merciful -> Ruthless arc counts. Recorded before the
    // downed branch so it counts the decision, not the outcome.
    if (victim.downed || victim.health <= COMBAT.finishingHealthThreshold) {
        killer.finishingBlows = (killer.finishingBlows ?? 0) + 1;
    }
    if (!victim.downed && shouldGoDown(ctx, victim)) {
        goDown(ctx, victim, victim.lastDamage?.cause || `Killed by ${killer.name}`, killer.id);
        return;
    }
    killTribute(ctx, victim, killer, { weapon });
}

/** §9.1: whether this killing blow should open the window instead of closing it. */
function shouldGoDown(ctx: SimContext, t: Tribute): boolean {
    if (t.everDowned) return false;
    // The bloodbath is the one place the arena is not interested in a second act.
    if (ctx.state.phase === 'bloodbath') return false;
    const record = t.lastDamage;
    if (!record || !DOWNABLE_DAMAGE.includes(record.kind)) return false;
    // Once the field is down to finalists the Gamemakers stop allowing it.
    // The living field, counted as the endgame counts it: somebody already in
    // the window is not somebody the Gamemakers are still running Games for.
    // `checkDeath` reaches here before the death lands, so `t` is included —
    // strictly above the floor is the guard that keeps a downed tribute out
    // of a final two, which `checkDualVictory` has no other defence against.
    const standing = ctx.state.tributes.filter(o => o.status === 'alive' && !o.downed).length;
    if (standing <= DOWNED.finalistFloor) return false;
    const chance = Math.min(DOWNED.maxChance,
        DOWNED.baseChance + attr(t, 'endurance') * DOWNED.perEndurance);
    return ctx.rng.chance(chance);
}

/**
 * A weighted draw from a list, for the places combat has to make a choice that
 * leans without being decided. `reduce`-to-the-maximum is the right shape for
 * "who leads the pack" and the wrong one for "who swings at whom" — the latter
 * wants a favourite, not a winner.
 */
function weightedPick<T>(ctx: SimContext, items: T[], weight: (item: T) => number): T {
    const weights = items.map(weight);
    const total = weights.reduce((sum, w) => sum + Math.max(0, w), 0);
    if (total <= 0) return ctx.rng.pick(items);
    let roll = ctx.rng.nextFloat() * total;
    for (let i = 0; i < items.length; i++) {
        roll -= Math.max(0, weights[i]);
        if (roll <= 0) return items[i];
    }
    return items[items.length - 1];
}

/**
 * A §8: shock — a one-cycle state separate from sanity.
 *
 * Sanity is a slow ledger of everything the arena has done to somebody over a
 * whole run. What it could not express is the thirty seconds after a blow that
 * nearly took your head off: not madness, not a wound, just a body that has
 * stopped taking instructions. Set by a single hit that takes a tribute
 * through the line, and by coming round after being downed.
 */
export function enterShock(ctx: SimContext, t: Tribute, cause: string) {
    if (t.status !== 'alive') return;
    /*
     * AUDIT-6 §7.2: shock that is fatal on its own.
     *
     * Shock existed as a two-cycle debuff and could never be the thing that
     * killed anybody, so a tribute whose composure had already gone and who
     * then took a deep wound died of the wound like anyone else. Composure is a
     * whole modelled axis and this is the one place it should be able to be
     * decisive: the difference between a fighter who absorbs a blow and one who
     * has nothing left to absorb it with is not how deep the cut was.
     */
    if (composureOf(t) <= UNIVERSAL_DEATHS.shockComposure && ctx.rng.chance(UNIVERSAL_DEATHS.shockChance)) {
        applyDamage(ctx, t, UNIVERSAL_DEATHS.shockDamage, { cause: 'Went into shock', kind: 'status' });
        if (t.status !== 'alive' || t.health <= 0) {
            ctx.logEvent(
                `${t.name} sits down in ${t.zone} and stops. The wound is not the worst anybody has taken today. `
                + 'They simply had nothing left to take it with.',
                [t.id], { important: true, zone: t.zone, category: 'death' },
            );
            checkDeath(ctx, t, 'Went into shock');
            return;
        }
    }
    t.shock = { untilCycle: (ctx.state.cycle ?? 0) + SHOCK.cycles, cause };
    if (ctx.rng.chance(SHOCK.lineChance)) {
        ctx.logEvent(
            `${t.name} comes out the other side of it standing, and that is all that can be said for them. `
            + 'They are not hearing anything for a while.',
            [t.id],
            { category: 'injury' }
        );
    }
}

/** True while the shock is still on them. */
export function inShock(ctx: SimContext, t: Tribute): boolean {
    return t.shock !== undefined && (ctx.state.cycle ?? 0) < t.shock.untilCycle;
}

function bestWeapon(t: Tribute): Item | undefined {
    const weapons = t.inventory.filter(i => i.type === 'weapon');
    if (weapons.length === 0) return undefined;
    // Condition counts: a battered sword can be the worse choice than a fresh
    // knife. A §7: so does which arm is open. `woundedSide` and `handedness`
    // existed and nothing downstream of the damage roll read them — a tribute
    // with their sword arm laid open picked the same greatsword as ever. A
    // heavy weapon needs the hand that is gone; a light one does not.
    const armGrade = injuryGrade(t, 'arms');
    const leadHurt = armGrade > 0 && (t.woundedSide ?? 'right') === (t.handedness ?? 'right');
    const penalty = (w: Item) => {
        if (armGrade === 0) return 0;
        const perGrade = leadHurt ? INJURY_BEHAVIOUR.weaponHandPerGrade : INJURY_BEHAVIOUR.offHandPerGrade;
        // The heavier the weapon, the more of it the bad arm has to carry.
        const heft = w.value >= INJURY_BEHAVIOUR.twoHandedDamage ? 2 : 1;
        return effectiveDamage(w) * perGrade * armGrade * heft;
    };
    return weapons.reduce((best, w) =>
        (effectiveDamage(w) - penalty(w) > effectiveDamage(best) - penalty(best) ? w : best));
}

/**
 * Every point of health a tribute loses now goes through here.
 *
 * Cause of death used to be inferred after the fact from a fixed priority
 * chain — poison beat frostbite beat thirst — which cheerfully reported
 * "Succumbed to poison" for a tribute who had just been mauled by mutts while
 * carrying a scratch of venom. Recording the source at the moment of the wound
 * costs one field and makes the obituary true.
 */
/**
 * @returns true when this call held a finalist back from a non-tribute death
 * that would otherwise have landed. `applyStatusDamage` (survival.ts) reads
 * this to relieve whatever actually caused it — see the comment on the
 * finalist-protection block below for why that relief has to happen, not
 * just the clamp.
 */
/**
 * §11 (requests): whether the field is down to two and still inside the window
 * in which the arena is not allowed to finish one of them by attrition.
 *
 * `finalTwoCycle` is stamped the first time this is asked with two alive, so
 * the window is measured from the moment the final two existed rather than
 * from the convergence (which may have been called at six) or from the day
 * count (which says nothing about how long these two have been the only ones
 * left).
 */
export function inFinalTwoGrace(ctx: SimContext, alive: number): boolean {
    if (alive !== 2) return false;
    const now = cycleOf(ctx.state);
    if (ctx.state.finalTwoCycle === undefined) ctx.state.finalTwoCycle = now;
    return now - ctx.state.finalTwoCycle < ESCALATION.finalTwoAttritionGraceCycles;
}

/**
 * §24 (requests): whether the arena has already taken more than its share of
 * this cast, and this particular killing blow should be pulled.
 *
 * Returns true only when all three hold: the field has thinned past the
 * opening (so the bloodbath and day one are untouched), the arena's own death
 * count is past the soft cap, and the roll lands. The roll steepens between
 * the soft and hard caps, so an arena that keeps killing keeps being reined
 * in harder rather than hitting a wall.
 */
function arenaOverBudget(ctx: SimContext, alive: number): boolean {
    const cast = ctx.state.tributes.length;
    if (cast === 0) return false;
    if (alive > cast * ARENA_DEATH_BUDGET.activeBelowAliveShare) return false;
    const taken = ctx.state.environmentalDeaths ?? 0;
    const soft = cast * ARENA_DEATH_BUDGET.softCapShare;
    if (taken < soft) return false;
    const hard = cast * ARENA_DEATH_BUDGET.hardCapShare;
    const through = hard > soft ? Math.min(1, (taken - soft) / (hard - soft)) : 1;
    const chance = ARENA_DEATH_BUDGET.sparedChanceAtCap
        + through * (ARENA_DEATH_BUDGET.sparedChanceAtHardCap - ARENA_DEATH_BUDGET.sparedChanceAtCap);
    return ctx.rng.chance(chance);
}

export function applyDamage(
    ctx: SimContext,
    t: Tribute,
    amount: number,
    record: Omit<DamageRecord, 'cycle' | 'amount'>,
): boolean {
    if (amount <= 0) return false;
    // You cannot wound a corpse. Without this, any caller that damages a
    // tribute killed earlier in the same pass silently overwrites the damage
    // record their obituary was built from.
    if (t.status !== 'alive') return false;

    // §9.1: while they are in the rescue window they are out of the damage
    // system entirely. This reads like a bug until you follow the callers:
    // `applyStatusDamage` (survival.ts) puts bleeding, infection, venom,
    // thirst, starvation, exhaustion and frostbite through here every single
    // cycle, and a downed tribute sits at exactly 0 health — so any damage
    // that landed at all would kill them on the next status tick and the
    // window would be zero cycles wide in practice. `tickDowned` owns their
    // ending: rescue, execution, or the clock running out.
    if (isDowned(t)) return false;

    // Armour. Only against things that hit you — a padded vest does nothing
    // about thirst, venom already in the blood, or an infected wound.
    if (ARMOURED_DAMAGE.includes(record.kind)) {
        const soak = armourOf(t);
        if (soak > 0) {
            const absorbed = amount * soak;
            amount -= absorbed;
            wearArmour(t, absorbed * QUALITY.armourWearPerPoint);
        }
    }
    // §3.1: soft tissue between a blade and the parts that matter. Condition,
    // not frame — and it is the first thing the run takes off a starving
    // tribute, so a long run strips the padding before it strips the health.
    if (ARMOURED_DAMAGE.includes(record.kind)) amount *= 1 - injuryAbsorption(t);
    amount = Math.max(1, Math.round(amount));

    // §7: the Gamemakers want a victor, not an empty arena.
    //
    // This rule already existed, but only inside the border-collapse pass —
    // so it stopped the wall from finishing the last two and did nothing
    // about the other dozen ways a finalist can die. Runs were still ending
    // with nobody left, mostly to thirst, infection and venom quietly running
    // out the clock on the last tribute standing. Every canonical Games
    // produces a victor (occasionally two, which this engine already models
    // on purpose), so a wipeout is the largest canon-fidelity failure
    // available to it.
    //
    // Only the arena is held back. Another tribute can always land the
    // killing blow — a final two who fight it out to a genuine mutual kill is
    // a real ending, and the audience is entitled to it. What is no longer
    // possible is the arena itself running out of contestants by attrition.
    //
    // Deliberately as narrow as it can be: this fires only when the tribute
    // about to die is the *last one breathing*, because that is the only death
    // that actually produces a wipeout. An earlier version protected both
    // finalists (ESCALATION.finalistCount), which did stop the wipeouts but
    // left two tributes pinned at 1 health for as long as it took them to find
    // each other — average run length went from 9.3 days to 13.2 and resolve
    // breakdowns rose sevenfold, because a tribute held alive at 1 HP is a
    // tribute whose will to continue is collapsing every single cycle. Letting
    // the second-to-last death land normally costs nothing (it leaves a
    // victor, which is the goal) and keeps the endgame's pacing intact.
    //
    // A clamp alone is not enough for a *recurring* cause: thirst and poison
    // reapply every cycle, so the last survivor would be held at 1 health
    // rather than actually being saved. The return value tells the status-tick
    // caller a rescue happened, so it can relieve the actual cause rather than
    // just softening its damage.
    let finalistSave = false;
    if (record.kind !== 'tribute') {
        const alive = ctx.state.tributes.filter(o => o.status === 'alive').length;
        if (alive <= 1 && amount >= t.health) {
            amount = Math.max(0, t.health - 1);
            finalistSave = true;
        }
        // §11 (requests): the last two settle it between them, not by whose
        // wound went bad first and not by the weather. Bounded to a few cycles
        // from the moment the field reached two — see
        // `finalTwoAttritionGraceCycles` for why it is a window and not a rule.
        // The return value matters here: the status tick reads it and relieves
        // the actual cause, so the tribute is not merely pinned at 1 health and
        // re-killed every cycle.
        //
        // Covers everything that is not another tribute. Held to `status`
        // first, which moved the measured "victor killed the runner-up" share
        // from 23% to 35% and then simply handed the ending to `climate` and
        // `arena` instead — 72 of 193 endings. The arena finishing the
        // second-to-last tribute is the same failure wearing different
        // clothes, and §24 says so independently.
        if (!finalistSave && amount >= t.health && inFinalTwoGrace(ctx, alive)) {
            amount = Math.max(0, t.health - 1);
            finalistSave = true;
        }
        // §24 (requests): the arena's share of the killing, capped.
        //
        // Same shape as the finalist save above and for a related reason: the
        // arena is scenery for a story about people, and a run where it takes
        // most of the cast has no story left in it. Past its budget every
        // further environmental killing blow is rolled against, and a spared
        // tribute is left on one health — the arena has still all but killed
        // them, and the next person to find them will finish it.
        if (!finalistSave && amount >= t.health && arenaOverBudget(ctx, alive)) {
            amount = Math.max(0, t.health - 1);
            finalistSave = true;
        }
        if (amount <= 0) return finalistSave;
    }

    const before = t.health;
    t.health -= amount;
    t.lastDamage = { ...record, cycle: cycleOf(ctx.state), amount };
    clampTribute(t);
    // A §8: one blow that takes somebody through the line puts them in shock
    // for a cycle — a near-death that is not a wound and not a breakdown.
    if (t.status === 'alive' && t.health > 0
        && amount >= SHOCK.minHit
        && before >= SHOCK.healthLine && t.health < SHOCK.healthLine) {
        enterShock(ctx, t, record.cause);
    }
    return finalistSave;
}

/**
 * A death nobody else landed: the tribute ended it themselves.
 *
 * §BUG-3: both self-inflicted endings (nightlock, the border walk) used to
 * write `t.health = 0` directly and then call `checkDeath` with a fallback
 * cause. `checkDeath` only reaches for the fallback when `lastDamage` is
 * empty — and it never is, because it still holds whatever hurt them last,
 * hours or days earlier. So a tribute who took the nightlock was buried under
 * "Died of dehydration", and if that stale record carried a `sourceId` the
 * tribute who scratched them a week ago was credited with the kill. Measured
 * across 300 runs: 36 nightlock deaths, 0 of them recorded as nightlock, and
 * one false kill credit. That broke the obituary, the victor's kill count and
 * the nightlock-ending achievement at once.
 *
 * Overwriting the record with a sourceless `status` wound is the whole fix:
 * the cause is now the true one and no killer can be found for it. This does
 * *not* go through `applyDamage`, deliberately — the finalist-protection
 * clamp there exists to stop the arena wiping the field out, and a tribute
 * choosing to stop is not the arena.
 */
export function selfInflictedDeath(ctx: SimContext, t: Tribute, cause: string, silent = false) {
    if (t.status !== 'alive') return;
    t.lastDamage = { cause, kind: 'status', cycle: cycleOf(ctx.state), amount: t.health };
    t.health = 0;
    clampTribute(t);
    checkDeath(ctx, t, cause, silent);
}

/** Kills the tribute if the last wound finished them, attributing it correctly. */
export function checkDeath(ctx: SimContext, t: Tribute, fallbackCause?: string, silent = false) {
    if (t.health > 0 || t.status !== 'alive') return;
    // §9.1: a tribute in the rescue window is at zero health on purpose.
    // `tickDowned` owns their ending; nothing else may fire the cannon.
    if (t.downed) return;
    const record = t.lastDamage;
    // The funnel every death goes through is the only honest place to decide
    // that this one is not a death yet.
    if (shouldGoDown(ctx, t)) {
        goDown(ctx, t, record?.cause || fallbackCause || 'Died of their wounds', record?.sourceId);
        return;
    }
    // Aliveness decides whether the killer gets credit for the kill, not
    // whether they get credit for the wound — a mutual kill still has a true
    // obituary even though the killer dropped in the same exchange.
    const killer = record?.sourceId
        ? ctx.state.tributes.find(o => o.id === record.sourceId)
        : undefined;
    // §24 (requests): the arena's running tally, kept here because this is the
    // one funnel every death passes through. A death with no killer and a
    // non-`tribute` damage record is the arena having done it — mutts,
    // hazards, climate, zone effects, set pieces and the closing border alike.
    // A self-inflicted ending writes `kind: 'status'` with no source and is
    // deliberately not counted: nobody needs protecting from their own choice.
    if (!killer && record && record.kind !== 'tribute' && record.kind !== 'status') {
        ctx.state.environmentalDeaths = (ctx.state.environmentalDeaths ?? 0) + 1;
    }
    if (killer) {
        killTribute(ctx, t, killer, { cause: record?.cause, silent });
    } else {
        killTribute(ctx, t, undefined, { cause: record?.cause || fallbackCause, silent });
    }
}

/**
 * Effective attribute reads, so age stops being cosmetic. A
 * twelve-year-old with a printed strength of 9 still has a twelve-year-old's
 * frame behind the blade; an eighteen-year-old fights at full weight.
 */
export function effectiveStrength(t: Tribute): number {
    const yearsFromPrime = Math.max(0, 17 - t.age);
    return Math.max(1, t.attributes.strength - yearsFromPrime * 0.4);
}

/**
 * What a previous fight with this specific person is worth.
 *
 * A rivalry used to be a decaying scalar, so a third fight between the same two
 * tributes was mechanically identical to the first. Someone who has lost to a
 * particular opponent has watched them work: they know the reach, the favoured
 * side, when the guard drops. That is worth something, and it is worth more the
 * more times it has happened.
 */
function rematchEdge(t: Tribute, opponent?: Tribute): number {
    if (!opponent) return 0;
    const record = ensureMemory(t).rivals?.[opponent.id];
    if (!record || record.fights === 0) return 0;
    // Only the party who came off worse has anything to learn.
    if (record.woundsTaken <= record.woundsDealt) return 0;
    return Math.min(RIVALRY.maxStudyBonus, record.fights * RIVALRY.revengeStudyBonus);
}

/**
 * §8a: how well this tribute's group still fights as one, 0-1ish.
 *
 * Average regard toward the allies actually standing with them. A fresh
 * alliance fights at full numbers; one that has spent a week eroding fights
 * closer to a collection of individuals who happen to be in the same clearing.
 */
function packCohesion(ctx: SimContext, t: Tribute): number {
    if (!t.allianceId) return 1;
    const mates = ctx.state.tributes.filter(o =>
        o.status === 'alive' && o.id !== t.id && o.allianceId === t.allianceId && o.zone === t.zone);
    if (mates.length === 0) return 1;
    const regard = mates.reduce((sum, o) => sum + getRel(t, o.id), 0) / mates.length;
    const scaled = COMBAT.packCohesionFloor
        + (1 - COMBAT.packCohesionFloor) * Math.max(0, Math.min(1, regard / COMBAT.packCohesionFullRegard));
    return scaled;
}

/**
 * A fighter's power as an *estimate*: everything on the sheet and in the
 * situation, and nothing rolled. This is what ranking and weighting read —
 * "who is the strongest attacker here" has to have one answer, and it used
 * to re-roll a die inside every comparison, which made the reduce below
 * non-transitive and burned a handful of RNG draws per round just picking a
 * lead. The die lives in `contestedPower`, which only the exchanges use.
 */
function combatPower(ctx: SimContext, t: Tribute, weapon?: Item, allies = 0, opponent?: Tribute): number {
    let power = effectiveStrength(t) + effectiveAgility(t);

    if (weapon) {
        power += weapon.damage !== undefined ? effectiveDamage(weapon) : weapon.value / 10;
        // Ranged weapons reward agility; melee rewards raw strength
        // Every weapon class scales with something. 'thrown' had no branch at
        // all, so Throwing Knives and the Spear — the one weapon a tribute can
        // craft mid-run — were the only weapons in the game with no stat
        // scaling behind them, which made crafting a downgrade.
        if (weapon.weaponClass === 'ranged') {
            power += Math.floor(effectiveAgility(t) / COMBAT.rangedAgilityDivisor) + traitMod(t, 'rangedPower');
        } else if (weapon.weaponClass === 'melee') {
            power += Math.floor(effectiveStrength(t) / COMBAT.meleeStrengthDivisor) + traitMod(t, 'meleePower');
            // Reach: a long-armed tribute lands first in a melee. `heightCm` was
            // generated with care and then read only by display code.
            power += reachBonus(t);
        } else if (weapon.weaponClass === 'thrown') {
            // Throwing wants both the arm behind it and the eye in front of it.
            power += Math.floor(effectiveStrength(t) / COMBAT.thrownStrengthDivisor)
                + Math.floor(effectiveAgility(t) / COMBAT.thrownAgilityDivisor)
                + traitMod(t, 'rangedPower') * 0.5 + traitMod(t, 'meleePower') * 0.5;
        }
        // Practice with the class of weapon actually in their hands.
        power += profOf(t, weaponProficiency(weapon.weaponClass)) * PROFICIENCY.combatWeight;
        // And familiarity with this *particular* weapon, from home rather than
        // from the training centre. A trident is a fishing tool to District 4
        // and an awkward three-pronged spear to everybody else.
        power += weaponAffinity(t, weapon);
        // §3.2: and how long it has actually been in their hands. Affinity is
        // where they are from; handling is what they have done this week.
        power += weaponHandling(t, weapon);
    } else {
        // Bare hands are a grapple, and a grapple is decided by mass, reach and
        // whether they have ever done this before. §3.1: frame is what makes
        // somebody hard to move, independent of how well fed they are.
        power += reachBonus(t) + grappleResistance(t) * COMBAT.limbPowerPenaltyPerGrade + traitMod(t, 'unarmedPower');
    }
    power += traitMod(t, 'combatPower');

    // Archetype edge: aggressive fighters commit harder
    power += ARCHETYPES[t.archetype].aggression * 4;

    // Injury and status penalties
    // T-5: a shattered arm is not a bruised one — penalties scale with grade.
    // §3.1: a left-handed tribute with a ruined left arm is far worse off than
    // a right-handed one with the same wound.
    power -= injuryGrade(t, 'arms') * COMBAT.limbPowerPenaltyPerGrade
        * dominantSideCost(t, 'arms', t.woundedSide);
    power -= injuryGrade(t, 'legs') * COMBAT.limbPowerPenaltyPerGrade;
    if (t.injuries.poisoned) power -= 3;
    if (t.injuries.burned) power -= 1;
    if (t.injuries.frostbitten) power -= 2;
    if (t.vitals.fatigue > 80) power -= 2;
    // A wrecked tribute fights like one.
    power -= (100 - t.health) / 22;
    // §3.3: a pack laden with the horn's contents is slower where it counts.
    power -= encumbranceOf(t) * INVENTORY.encumbrancePowerPenaltyMax;

    // Numbers advantage: the whole point of a pack — but a pack is only worth
    // its numbers while it is still a pack.
    //
    // §8a: the Career archetype wins at 2.2x the field average not on one
    // axis but on six multiplicative ones, and this is the last of them: the
    // numbers bonus was flat, so a Career pack three days into open mutual
    // suspicion fought exactly as well together as it did on day one. It now
    // decays with the group's own trust, which is the mechanic the alliance
    // layer already simulates and combat never read.
    const cohesion = packCohesion(ctx, t);
    power += Math.min(COMBAT.outnumberMaxBonus, allies * COMBAT.outnumberPowerPerAlly) * cohesion;

    // Bloodlust. A tribute who has just killed is keyed up and dangerous — this
    // is what lets a hunter snowball instead of every fight starting from zero.
    power += (t.momentum ?? 0) * HUNTING.momentumPowerWeight;
    // §3.4: a shaken tribute fights below their numbers.
    power -= (t.rattled ?? 0) * HUNTING.rattledPowerWeight;

    // A1: what the conditional stances are worth in an exchange. Desperate is
    // the state `desperationFights` was only ever a coin flip for; Scavenging
    // is somebody who did not want this fight and is not equipped for it.
    if (t.stance === 'Desperate') power += STANCE_MODES.desperate.powerBonus;
    if (t.stance === 'Scavenging') power -= STANCE_MODES.scavenging.combatPenalty;

    // What they have learned from losing to this person before.
    power += rematchEdge(t, opponent);

    // Vengeful is not a general combat bonus — it is a bonus against the
    // specific person they cannot let go of.
    if (opponent && traitMod(t, 'vengeanceEdge') !== 0
        && (hasVengeanceAgainst(t, opponent.id) || getRel(t, opponent.id) <= COMBAT.vengefulHatredRegard)) {
        power += traitMod(t, 'vengeanceEdge');
    }

    /*
     * AUDIT-8 §8.1: the Archivist, converting.
     *
     * Its set piece fires for 59% of holders and it still finished bottom of
     * the win table at 2.16%, with the lowest average kills in the roster
     * (0.38). Giving the beat a payoff in `RivalRecord.read` — everything it
     * has been keeping a tally of, turned into a measure of everyone still
     * standing — helped it *avoid* fights, because `read` is consumed by the
     * threat estimate. Avoiding fights does not win a Games; the field has to
     * empty, and an archetype that contributes nothing to that has no path.
     *
     * Knowing exactly how somebody fights is a fighting advantage, and this
     * is the one archetype whose whole premise is knowing. Scaled by the read
     * itself, so it is worth nothing against a stranger and most against the
     * person they have been writing down all week — which is also what makes
     * it a `late-blooming` curve rather than a flat bonus.
     */
    if (opponent && t.archetype === 'archivist') {
        power += readOf(t, opponent.id) * ARCHETYPE_HOOKS.archivistReadPower;
    }

    return power;
}

/** `combatPower` plus the swing of the moment — the roll the exchange is decided on. */
function contestedPower(ctx: SimContext, t: Tribute, weapon?: Item, allies = 0, opponent?: Tribute): number {
    return combatPower(ctx, t, weapon, allies, opponent) + ctx.rng.nextInt(0, COMBAT.powerSwingMax);
}

/**
 * Per-round retreat check. Nobody has to fight to the death.
 *
 * §1.3: `opponentEdge` is *the power differential from `t`'s point of view* —
 * positive means the person in front of them is winning. That is one number
 * with one meaning, and it now is at every call site.
 *
 * It was not. The duel loop passed the real differential (`±edge`), the group
 * brawl passed a headcount proxy (`max(1, advantage)` to the outnumbered side
 * and a flat `0` to the pack), and the free-for-all passed a constant `1` to
 * everyone in the zone. So the same tribute in the same fight got a different
 * answer depending on which loop happened to be resolving it, and the
 * chokepoint penalty below — which subtracts from the same `chance` the
 * losing bonus adds to — was arbitrating against a different quantity in each
 * path. In the pack case it was worse than inconsistent: an attacker was
 * hard-coded to `0`, so a lead who was *losing* to a stronger lone defender
 * could never earn `retreatLosingBonus` at all, and the numbers advantage the
 * group maths had already priced into `edge` was then counted a second time as
 * a headcount.
 *
 * The fix is not a new rule, it is deleting two of the three conventions: the
 * group and free-for-all paths now hand over the same resolved `edge` the
 * damage roll used, signed per combatant. The numbers advantage still reaches
 * this function — `combatPower` folds it into `edge` — it just is not also
 * substituted for it.
 */
function wantsToRetreat(ctx: SimContext, t: Tribute, opponentEdge: number, roundsFought: number, opponent?: Tribute): boolean {
    // §7: once the Gamemakers have forced the finale, there is nowhere to
    // retreat *to* — the arena has been drained down to the horn. Without
    // this, the two finalists met, the loser fled at low health, finalist
    // protection kept them alive to recover, and the pair looped like that
    // for hundreds of days. The finale is to the death because the arena
    // makes it so, not because anyone stopped being afraid.
    const aliveCount = ctx.state.tributes.filter(o => o.status === 'alive').length;
    if (aliveCount <= ESCALATION.finalistCount
        && (ctx.state.finalistCycles ?? 0) >= ESCALATION.finaleAfterFinalistCycles) {
        return false;
    }

    // A1: Desperate ignores the retreat roll entirely. This is the difference
    // between a stance and a modifier — there is no number to tune, they simply
    // do not break off.
    if (t.stance === 'Desperate') return false;

    const arch = ARCHETYPES[t.archetype];
    const healthFraction = t.health / 100;
    if (healthFraction <= COMBAT.routHealthFraction) return true;

    // A2: `riskCurve` is where caution actually moves. A Zealot on day 9 is
    // the Zealot from day 1; a Career has spent everything by then; a
    // Strategist has been getting warier the whole time.
    let chance = COMBAT.retreatBase
        + (1 - healthFraction) * COMBAT.retreatPerHealthLost
        + effectiveCaution(t, ctx.state.day) * COMBAT.retreatCautionWeight
        - arch.aggression * COMBAT.retreatAggressionWeight
        + Math.max(0, 17 - t.age) * COMBAT.retreatYouthWeight
        + roundsFought * 0.05;

    if (opponentEdge > 0) chance += COMBAT.retreatLosingBonus;
    // A §8: somebody in shock is not weighing anything. They break off.
    if (inShock(ctx, t)) chance += COMBAT.retreatLosingBonus;
    chance += traitMod(t, 'retreat');
    // A §4: the same composite the stance table reads. A tribute with nothing
    // left to lose and a shrinking field stands; one with a full pack on day
    // nine at half health takes the exit.
    chance -= riskTolerance(ctx, t) * RISK.retreatWeight;
    if (t.isCareer) chance -= 0.1;
    if (isAggressiveStance(t.stance)) chance -= 0.12;
    if (isEvasiveStance(t.stance)) chance += 0.15;
    // Who they are fighting, not just how badly it is going: a tribute who has
    // watched this particular person kill wants out long before the numbers say so.
    if (opponent) chance += fearFraction(t, opponent.id) * FEAR.retreatWeight;
    // §3.5: and what they have merely *heard* about them, which is weaker than
    // having seen it but is the reason a name works on somebody who has never
    // met the person carrying it.
    if (opponent) chance += notorietyFraction(t, opponent.id) * NOTORIETY.retreatWeight;
    // §5.2: a chokepoint has nowhere to run to — breaking off is harder to
    // choose when the exit is a bottleneck the opponent can watch.
    const zoneHere = getZone(ctx.state.arena, t.zone);
    if (zoneHere && zoneFeatures(zoneHere).chokepoint) chance -= STEALTH.chokepointRetreatPenalty;
    // Bloodlust cuts the other way — a fresh kill is hard to walk away from.
    chance -= (t.momentum ?? 0) * HUNTING.momentumRetreatWeight;
    chance += (t.rattled ?? 0) * HUNTING.rattledRetreatWeight;
    // Neither party wants to be the one who runs again.
    if (opponent) {
        const record = ensureMemory(t).rivals?.[opponent.id];
        if (record && record.fights >= RIVALRY.feudAtFights) chance -= RIVALRY.rematchResolve;
    }

    return ctx.rng.chance(Math.max(0.02, Math.min(0.9, chance)));
}

function wearWeapon(weapon: Item | undefined) {
    if (weapon && weapon.durability !== undefined) weapon.durability -= COMBAT.weaponWearPerRound;
}

function dropBrokenWeapons(t: Tribute) {
    t.inventory = t.inventory.filter(i => i.type !== 'weapon' || i.durability === undefined || i.durability > 0);
}

/** Applies one landed hit, including venom, wounds and the grudge it earns. */
/**
 * §(requests): how lethal this particular thing is in a hand.
 *
 * Centred so the average weapon in the table is neutral; the spread is the
 * point. Bare hands are below everything that can be picked up, and the cap
 * keeps the heavy end from turning every exchange into one blow.
 */
function weaponLethality(weapon?: Item): number {
    if (!weapon) return COMBAT.unarmedLethality;
    return Math.min(
        COMBAT.weaponLethalityCap,
        COMBAT.weaponLethalityBase + effectiveDamage(weapon) * COMBAT.weaponLethalityPerDamage,
    );
}

function landHit(ctx: SimContext, attacker: Tribute, defender: Tribute, edge: number, weapon?: Item, multiplier = 1) {
    // §3.2: a landed blow is a swing that taught them something about this
    // particular weapon. Recorded here rather than at the pick-up so carrying
    // a bow you never fire never makes you an archer.
    //
    // The first swing with something cold gets a line, once — otherwise the
    // cost is a number nobody can see, and the whole point is that a reader
    // should understand why the tribute who just traded up is fighting worse.
    if (isUnfamiliar(attacker, weapon) && (attacker.weaponFamiliarity?.[weapon!.id] ?? 0) === 0) {
        ctx.logEvent(
            `${attacker.name} swings the ${weapon!.name} and it does not go where they meant it to. `
            + 'It is a good weapon. It is not their weapon, not yet.',
            [attacker.id],
            { category: 'combat' }
        );
    }
    noteWeaponUse(attacker, weapon);
    // §3.5: they are looking right at each other. Whatever either of them had
    // heard about the other is now measured against the person in front of
    // them, in both directions.
    witnessReputation(defender, attacker);
    witnessReputation(attacker, defender);
    // §(requests): the weapon decides how hard the blow lands, not only who
    // lands it. See `COMBAT.weaponLethalityBase` for why — in short, a
    // slingshot used to finish people at a trident's rate.
    const weight = multiplier * weaponLethality(weapon);
    const raw = (COMBAT.baseHitDamage + edge * COMBAT.damagePerPowerPoint + ctx.rng.nextInt(-3, 4)) * weight;
    // Both bounds scale with the multiplier, or a sub-1 multiplier puts the
    // floor above the ceiling.
    const damage = Math.round(Math.max(COMBAT.minRoundDamage * weight, Math.min(COMBAT.maxRoundDamage * weight, raw)));

    applyDamage(ctx, defender, damage, {
        cause: weapon ? `Killed by ${attacker.name} (${weapon.name})` : `Killed by ${attacker.name}`,
        sourceId: attacker.id,
        kind: 'tribute',
    });

    // A tribute who went down mid-round is out of the damage system, and the
    // riders have to respect that too: `applyDamage` refuses the blow, and
    // opening wounds, breaking limbs, setting them alight and teaching them a
    // new fear on the strength of a blow that did not land is the same bug one
    // layer down. `tickDowned` owns what happens to them now. The swing still
    // counted for the attacker — the familiarity and the reputation read above
    // both already happened.
    //
    // Asked of the defender directly rather than off `applyDamage`'s return
    // value, which is `finalistSave` on the success path and therefore false
    // for almost every ordinary landed hit. Keying the riders on it halved the
    // run's bleeding rate; `test:metrics` is what noticed.
    if (isDowned(defender) || defender.status !== 'alive') { wearWeapon(weapon); return 0; }

    if (ctx.rng.chance(COMBAT.bleedChance)) openWound(defender, BLEEDING.combatSeverity, attacker.id);
    if (ctx.rng.chance(COMBAT.woundChance)) {
        // Where it lands depends on what landed it and how practised the hand
        // was. A bow finds the body; a club finds the head; a blade opens the
        // arm that is put out to stop it.
        const cls = weapon?.weaponClass ?? 'unarmed';
        const base = COMBAT.woundSiteWeights[cls] ?? COMBAT.woundSiteWeights.unarmed;
        const skill = weapon ? profOf(attacker, weaponProficiency(weapon.weaponClass)) : 0;
        const weights = [base[0] + skill * COMBAT.woundSiteSkillHead, base[1], base[2], base[3]];
        const sites = ['head', 'torso', 'arms', 'legs'] as const;
        let roll = ctx.rng.nextFloat() * weights.reduce((a, b) => a + b, 0);
        let site: typeof sites[number] = 'torso';
        for (let i = 0; i < sites.length; i++) { roll -= weights[i]; if (roll <= 0) { site = sites[i]; break; } }
        injure(defender, site);
    }
    // A Pyromaniac fights dirty with whatever burns — every landed hit has a
    // real chance to leave the defender scorched, not just bruised.
    if (!defender.injuries.burned && traitMod(attacker, 'burnOnHit') > 0 && ctx.rng.chance(traitMod(attacker, 'burnOnHit'))) {
        injure(defender, 'burned');
        ctx.logEvent(
            `${attacker.name}'s strike leaves ${defender.name} scorched — Pyromaniacs make sure something is always burning.`,
            [defender.id, attacker.id],
            { category: 'injury' }
        );
    }
    if (weapon?.poison && ctx.rng.chance(COMBAT.poisonTransferChance) && !defender.injuries.poisoned) {
        injure(defender, 'poisoned');
        // §10.1: 'Venom' — the mark of an envenomed blade, distinct from the
        // arena's own poisons, so a later poison death reads as this weapon's.
        defender.poisonedByWeapon = true;
        ctx.logEvent(
            `${defender.name} is grazed by ${attacker.name}'s poisoned dart and feels the venom spreading.`,
            [defender.id, attacker.id],
            { important: true, category: 'injury' }
        );
    }
    wearWeapon(weapon);
    noteWound(attacker, defender);
    adjustRel(defender, attacker.id, -COMBAT.grudgeOnWound);
    // Losing an exchange to someone is how you learn to be afraid of them
    // specifically — and how the attacker gets better at the weapon they used.
    addFear(defender, attacker.id, FEAR.lostExchange);
    // §1.2: `rattled` is documented as the symmetric counterpart to momentum
    // and was written from grief and almost nothing else. Losing an exchange
    // shakes a person, and coming out of one barely standing shakes them more.
    rattle(defender, HUNTING.rattledPerLostExchange);
    if (defender.status === 'alive' && defender.health > 0 && defender.health < HUNTING.nearDeathHealth) {
        rattle(defender, HUNTING.rattledPerNearDeath);
    }
    // §3.2: and landing one on somebody you had only heard stories about is
    // how you learn the stories were bigger than the person.
    reduceFear(attacker, defender.id, FEAR.realityCorrection);
    if (weapon) trainProficiency(attacker, weaponProficiency(weapon.weaponClass), ctx);
    clampTribute(defender);
    return damage;
}

/**
 * A fight, resolved as a series of exchanges rather than one power comparison.
 *
 * The old version compared two numbers once: a three-point edge was instant
 * death, anything closer was a scripted draw. There was no such thing as a
 * fight someone walked away from on purpose, which meant no fleeing, no
 * wearing an opponent down over two encounters, and no tension in a rematch.
 */
export function resolveCombat(
    ctx: SimContext,
    t1: Tribute,
    t2: Tribute,
    isBloodbath: boolean = false,
    isBetrayal: boolean = false,
    /**
     * Rounds at the start of the fight in which neither side will break off.
     * The opening seconds of the bloodbath are not a decision anybody makes:
     * the gong goes and people commit. Everywhere else this stays 0 and the
     * per-round retreat check runs as it always has.
     */
    noRetreatRounds: number = 0,
    /** Multiplier on damage landed, for fights inside the killing zone. */
    damageMultiplier: number = 1,
) {
    if (t1.status === 'dead' || t2.status === 'dead') return;
    // §9.1: nobody in the rescue window is a combat opponent. Whatever happens
    // to them where they lie is `tickDowned`'s decision, not a duel's.
    if (isDowned(t1) || isDowned(t2)) return;

    // Star-crossed lovers refuse to fight each other!
    if (areLovers(t1, t2)) {
        ctx.logEvent(`${t1.name} and ${t2.name} refuse to fight each other due to their deep bond as star-crossed lovers.`, [t1.id, t2.id], { category: 'romance' });
        return;
    }

    noteContact(ctx.state, t1, t2);
    noteFight(ctx.state, t1, t2);
    // §5.8: a fight inside a ruin loads the structure. No arena opts in — the
    // primitive reads the terrain and ignores everything that is not stone.
    loadFromViolence(ctx.state, t1.zone);
    // §12: who opened it. `t1` is the initiator at every call site; a fight
    // they opened against somebody they already had cause against is
    // retaliation, not a first strike, which is the distinction 'Quiet Storm'
    // is actually about.
    if (!hasVengeanceAgainst(t1, t2.id) && (ensureMemory(t1).rivals?.[t2.id]?.woundsTaken ?? 0) === 0) {
        noteFightOpened(t1);
    }
    // A feud gets its own opening line once it is genuinely a feud.
    const priorFights = ensureMemory(t1).rivals?.[t2.id]?.fights ?? 0;
    if (priorFights > RIVALRY.feudAtFights) {
        ctx.logEvent(
            `${t1.name} and ${t2.name} have done this before — ${priorFights - 1} times now. Neither of them needs a reason any more.`,
            [t1.id, t2.id],
            { important: true, category: 'combat' }
        );
    }

    // The first argument is whoever found the other. If they found them from
    // cover, the fight opens with a free hit rather than a fair exchange. A
    // betrayal is always an ambush — the knife was never a fair fight in the
    // first place, whether or not the roll would have landed one.
    const zone = getZone(ctx.state.arena, t1.zone);
    const ambushed = !isBloodbath && (isBetrayal || rollAmbush(ctx, t1, t2, zone));
    if (ambushed) {
        // §1.2: being taken from cover is the single most shaking thing that
        // can happen to somebody who survives it.
        rattle(t2, HUNTING.rattledPerAmbushed);
        const opener = bestWeapon(t1);
        const damage = landHit(ctx, t1, t2, STEALTH.ambushPowerBonus, opener, STEALTH.ambushDamageMultiplier);
        ctx.logEvent(
            fill(ctx.pickText(DUEL_TEXTS.ambush), { attacker: t1.name, victim: t2.name, zone: t1.zone }),
            [t1.id, t2.id],
            // AUDIT-9: the 'AMBUSH:' prefix, as a field.
            { important: true, category: 'combat', type: 'ambush', actorId: t1.id }
        );
        if (t2.health <= 0) {
            strikeDown(ctx, t2, t1, opener);
            [t1, t2].forEach(t => { if (t.status === 'alive') dropBrokenWeapons(t); });
            return;
        }
        // Being jumped is a reason to leave, not to settle in.
        // §1.3: the differential the victim is actually facing, on the same
        // scale every other retreat check uses — the ambush bonus is spent on
        // the opening blow and does not carry into the second round, so what
        // they weigh is the standing fight, plus how much that first hit hurt.
        const ambushEdge = contestedPower(ctx, t1, opener, 0, t2)
            - contestedPower(ctx, t2, bestWeapon(t2), 0, t1)
            + damage / 10;
        if (noRetreatRounds < 1 && wantsToRetreat(ctx, t2, ambushEdge, 1, t1)) {
            ctx.logEvent(
                fill(ctx.pickText(DUEL_TEXTS.retreat), { fleer: t2.name, stayer: t1.name, zone: t1.zone }),
                [t2.id, t1.id],
                { important: true, category: 'combat' }
            );
            // Same bookkeeping as the main retreat path, for both sides:
            // fleeing feeds the rivalry record, and the ambusher holds a
            // grudge and remembers the zone as contested too.
            noteFled(t2, t1.id);
            adjustRel(t2, t1.id, -COMBAT.grudgePerFight);
            adjustRel(t1, t2.id, -COMBAT.grudgePerFight);
            addZoneThreat(ctx.state, t2, t2.zone, MEMORY.fightThreat);
            addZoneThreat(ctx.state, t1, t1.zone, MEMORY.fightThreat);
            [t1, t2].forEach(dropBrokenWeapons);
            return;
        }
    } else {
        ctx.logEvent(
            fill(ctx.pickText(DUEL_TEXTS.open), { t1: t1.name, t2: t2.name, zone: t1.zone }),
            [t1.id, t2.id],
            { category: 'combat' }
        );
    }

    // §11 (requests, second pass): the forced finale runs until it is settled.
    // `wantsToRetreat` already refuses to let either of them break off here;
    // without the matching round ceiling that only meant they stood there for
    // four exchanges and then the encounter ended anyway. See
    // `COMBAT.finaleExtraRounds`.
    const inForcedFinale = ctx.state.tributes.filter(o => o.status === 'alive').length <= ESCALATION.finalistCount
        && (ctx.state.finalistCycles ?? 0) >= ESCALATION.finaleAfterFinalistCycles;
    const maxRounds = COMBAT.maxRounds
        + (isBloodbath ? COMBAT.bloodbathExtraRounds : 0)
        + (inForcedFinale ? COMBAT.finaleExtraRounds : 0);
    let round = 0;
    let ended = false;

    while (round < maxRounds && isActive(t1) && isActive(t2)) {
        round++;
        // §7 (audit): exhaustion is now a way to die in a fight, not only a
        // way to fight worse. Legs go before nerve does.
        for (const [fighter, other] of [[t1, t2], [t2, t1]] as const) {
            if (!isActive(fighter) || !isActive(other)) continue;
            if (fighter.vitals.fatigue < COMBAT.collapseFatigue || !ctx.rng.chance(COMBAT.collapseChance)) continue;
            const cause = `Collapsed from exhaustion fighting ${other.name}`;
            applyDamage(ctx, fighter, COMBAT.collapseDamage, { cause, kind: 'tribute', sourceId: other.id });
            ctx.logEvent(
                fighter.health <= 0
                    ? `${fighter.name}'s legs give out mid-swing in ${fighter.zone} and ${other.name} does not have to do much about it.`
                    : `${fighter.name}'s legs go from under them in ${fighter.zone} — not struck, simply done — and ${other.name} gets a free blow in before they are up.`,
                [fighter.id, other.id],
                { important: fighter.health <= 0, category: 'combat' }
            );
            clampTribute(fighter);
            if (fighter.health <= 0) strikeDown(ctx, fighter, other, bestWeapon(other));
        }
        if (!isActive(t1) || !isActive(t2)) break;
        const w1 = bestWeapon(t1);
        const w2 = bestWeapon(t2);
        const p1 = contestedPower(ctx, t1, w1, 0, t2);
        const p2 = contestedPower(ctx, t2, w2, 0, t1);
        const edge = p1 - p2;

        if (Math.abs(edge) < 1.5) {
            ctx.logEvent(
                fill(ctx.pickText(DUEL_TEXTS.stalemate), { t1: t1.name, t2: t2.name, zone: t1.zone }),
                [t1.id, t2.id],
                { category: 'combat' }
            );
        } else {
            const winner = edge > 0 ? t1 : t2;
            const loser = edge > 0 ? t2 : t1;
            const weapon = edge > 0 ? w1 : w2;
            landHit(ctx, winner, loser, Math.abs(edge), weapon, damageMultiplier);
            // CONTENT-04: situational exchange lines. A hit on someone already
            // barely standing reads differently than an opening blow, and a
            // rematch between two people who have done this before should say so.
            const rematchLine = ensureMemory(winner).rivals?.[loser.id]?.fights ?? 0;
            const pool = loser.health <= COMBAT.finishingHealthThreshold ? DUEL_TEXTS.exchangeFinishing
                : rematchLine >= RIVALRY.feudAtFights ? DUEL_TEXTS.exchangeRematch
                : DUEL_TEXTS.exchange;
            ctx.logEvent(
                fill(ctx.pickText(pool), { winner: winner.name, loser: loser.name, zone: winner.zone }),
                [winner.id, loser.id],
                { category: 'combat' }
            );
            if (loser.health <= 0) {
                strikeDown(ctx, loser, winner, weapon);
                ended = true;
                break;
            }
        }

        // Retreat check, every round, for both sides — once anyone is capable
        // of making a decision again.
        if (round <= noRetreatRounds) continue;
        const t1Flees = wantsToRetreat(ctx, t1, -edge, round, t2);
        const t2Flees = wantsToRetreat(ctx, t2, edge, round, t1);
        if (t1Flees && t2Flees) {
            ctx.logEvent(
                fill(ctx.pickText(DUEL_TEXTS.mutualBreak), { t1: t1.name, t2: t2.name, zone: t1.zone }),
                [t1.id, t2.id],
                { important: true, category: 'combat' }
            );
            ended = true;
            break;
        }
        if (t1Flees || t2Flees) {
            const fleer = t1Flees ? t1 : t2;
            const stayer = t1Flees ? t2 : t1;
            noteFled(fleer, stayer.id);
            // Running turns your back on someone holding a weapon — unless you
            // are good at not being where they swing.
            const partingChance = Math.max(0.05,
                COMBAT.partingShotChance - fleer.attributes.stealth * STEALTH.disengagePerPoint);
            if (ctx.rng.chance(partingChance)) {
                const parting = bestWeapon(stayer);
                landHit(ctx, stayer, fleer, 2, parting);
                if (fleer.health <= 0) {
                    strikeDown(ctx, fleer, stayer, parting);
                    ended = true;
                    break;
                }
            }
            ctx.logEvent(
                fill(ctx.pickText(DUEL_TEXTS.retreat), { fleer: fleer.name, stayer: stayer.name, zone: stayer.zone }),
                [fleer.id, stayer.id],
                { important: true, category: 'combat' }
            );
            // Letting a beaten opponent walk is a choice, and the arena
            // remembers people who make it.
            if (fleer.health <= COMBAT.mercyHealth && !isBloodbath) {
                earnTrait(ctx, stayer, 'Merciful');
                addExcitement(stayer, 20);
            }
            ended = true;
            break;
        }
    }

    if (!ended && isActive(t1) && isActive(t2)) {
        ctx.logEvent(
            fill(ctx.pickText(DUEL_TEXTS.mutualBreak), { t1: t1.name, t2: t2.name, zone: t1.zone }),
            [t1.id, t2.id],
            { important: true, category: 'combat' }
        );
    }

    [t1, t2].forEach(t => {
        if (t.status !== 'alive') return;
        adjustRel(t, t.id === t1.id ? t2.id : t1.id, -COMBAT.grudgePerFight);
        addZoneThreat(ctx.state, t, t.zone, MEMORY.fightThreat);
        dropBrokenWeapons(t);
        checkDeath(ctx, t);
    });
}

/**
 * Group encounters: three tributes in a zone is not three duels, and
 * it is definitely not one duel with the other two standing politely aside.
 *
 * Sides are drawn from alliances and relationships, the outnumbered side
 * fights at a real disadvantage, and a gang-up focuses on one target — which
 * is what makes the Career pack frightening instead of decorative.
 */
export function resolveGroupCombat(ctx: SimContext, participants: Tribute[]) {
    const fighters = participants.filter(isActive);
    if (fighters.length < 3) {
        if (fighters.length === 2) resolveCombat(ctx, fighters[0], fighters[1]);
        return;
    }

    const zone = fighters[0].zone;

    // Sides: the largest alliance present anchors one side, everyone hostile to
    // it forms the other. Loners with no stake pick whoever they hate less.
    const allianceCounts = new Map<string, number>();
    fighters.forEach(f => {
        if (f.allianceId) allianceCounts.set(f.allianceId, (allianceCounts.get(f.allianceId) || 0) + 1);
    });
    let anchorId: string | undefined;
    let anchorSize = 1;
    allianceCounts.forEach((count, id) => {
        if (count > anchorSize) { anchorSize = count; anchorId = id; }
    });

    // Star-crossed lovers refuse to fight each other — the trait promises that
    // outright, so a bonded pair can never be assigned to opposite sides. A
    // standing truce holds here too: an agreement that only survived chance
    // meetings and evaporated in a brawl was not much of an agreement. Either
    // party can still break it, but that happens face to face in `tryParley`,
    // not as a side-effect of the sides being drawn.
    // §4.1: and a treaty between their two groups holds here as well, for the
    // same reason and one better — neither of these two agreed to it
    // personally, which is exactly what makes it a treaty. Breaking it is
    // still available; it just costs both blocs rather than one person.
    const isBonded = (a: Tribute, b: Tribute) =>
        areLovers(a, b) || hasTruce(ctx.state, a, b.id) || blocTreatyHolds(ctx, a, b);
    const partnerOf = (a: Tribute) => fighters.find(o => o.id !== a.id && isBonded(a, o));

    const packSide: Tribute[] = [];
    const otherSide: Tribute[] = [];
    fighters.forEach(f => {
        if (anchorId && f.allianceId === anchorId) packSide.push(f);
        else otherSide.push(f);
    });
    if (packSide.length === 0) {
        // No pack: split by mutual regard, so friends do not knife each other.
        //
        // If nobody in the zone gets on with anybody, there are no sides to draw
        // and forcing one produced an arbitrary 1-vs-2 decided by array order.
        // A genuine free-for-all is a real thing that happens at a feast and the
        // sides model could not represent it at all.
        const friendly = fighters.some(a => fighters.some(b =>
            a.id !== b.id && getRel(a, b.id) > 15 && getRel(b, a.id) > 15));
        if (!friendly) {
            resolveFreeForAll(ctx, fighters, zone);
            return;
        }
        const seed = otherSide.shift()!;
        packSide.push(seed);
        [...otherSide].forEach(f => {
            if (getRel(f, seed.id) > 15 && getRel(seed, f.id) > 15) {
                packSide.push(f);
                otherSide.splice(otherSide.indexOf(f), 1);
            }
        });
    }
    // Reunite any bonded pair that ended up split across sides.
    packSide.forEach(f => {
        const partner = partnerOf(f);
        if (partner && otherSide.includes(partner)) {
            otherSide.splice(otherSide.indexOf(partner), 1);
            packSide.push(partner);
        }
    });
    if (otherSide.length === 0) {
        // Everyone present is on the same side — no fight, but the reader
        // still gets a line explaining why the near-miss came to nothing.
        ctx.logEvent(
            fill(ctx.pickText(GROUP_COMBAT_TEXTS.standDown), { names: fighters.map(f => f.name).join(', '), zone }),
            fighters.map(f => f.id),
            { category: 'combat' }
        );
        return;
    }

    ctx.logEvent(
        fill(ctx.pickText(GROUP_COMBAT_TEXTS.open), { names: fighters.map(f => f.name).join(', '), zone }),
        fighters.map(f => f.id),
        // AUDIT-9: the 'GROUP FIGHT:' prefix is a structured kind that was
        // living inside the prose. This is the kind.
        { important: true, category: 'combat', type: 'group-fight' }
    );

    // Side membership as drawn, for the post-fight bookkeeping — breakers are
    // removed from the live arrays mid-fight but were still on their side.
    const origPack = new Set(packSide.map(t => t.id));
    const origOther = new Set(otherSide.map(t => t.id));

    // Rivalry bookkeeping: each pair that actually trades blows in this brawl
    // records one fight with each other — once per engagement, like a duel,
    // not once per round.
    const noted = new Set<string>();
    const noteGroupFight = (a: Tribute, b: Tribute) => {
        const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
        if (noted.has(key)) return;
        noted.add(key);
        noteFight(ctx.state, a, b);
    };

    let rounds = 0;
    while (rounds < COMBAT.maxGroupRounds) {
        rounds++;
        const left = packSide.filter(t => isActive(t) && t.zone === zone);
        const right = otherSide.filter(t => isActive(t) && t.zone === zone);
        if (left.length === 0 || right.length === 0) break;

        const attackers = ctx.rng.chance(left.length / (left.length + right.length)) ? left : right;
        const rawDefenders = attackers === left ? right : left;
        // Sides are reunited up front, but a bonded partner can still be
        // pulled onto the opposing side later by a death or a retreat — this
        // is the last line keeping the pair from being matched against each other.
        const defenders = rawDefenders.filter(d => !attackers.some(a => isBonded(a, d)));
        if (defenders.length === 0) break;
        const advantage = attackers.length - defenders.length;

        // Focus fire: the weakest defender, or a vengeance target if anyone has one.
        const sworn = defenders.find(d => attackers.some(a => hasVengeanceAgainst(a, d.id)));
        // §8: focus fire is where most of the arena's deaths are decided, and
        // it was the one place `targetDraw` — the whole of Unremarkable — did
        // not apply. It does now, alongside `defended`: an ally standing next
        // to somebody the group likes turns blows aside.
        const drawOf = (d: Tribute) => {
            const allyPresent = defenders.some(o => o.id !== d.id
                && o.allianceId !== undefined && o.allianceId === d.allianceId);
            // §3.3 (audit): the roles the alliance layer assigns finally mean
            // something in a fight. The muscle stands in front; the medic is
            // the one the others step in front of — when there is anybody to
            // step in front.
            const roles = d.allianceId ? ctx.state.alliances?.[d.allianceId]?.roles : undefined;
            const roleDraw = roles
                ? (roles.muscle === d.id ? COMBAT.roleMuscleDraw : 0)
                    - (roles.medic === d.id && allyPresent ? COMBAT.roleMedicShield : 0)
                : 0;
            return Math.max(COMBAT.minFocusWeight,
                Math.max(1, 100 - d.health)
                + targetDrawOf(d)
                + roleDraw
                - (allyPresent ? traitMod(d, 'defended') * COMBAT.defendedWeight : 0));
        };
        const target = sworn ?? (ctx.rng.chance(COMBAT.focusFireChance)
            ? weightedPick(ctx, defenders, drawOf)
            : ctx.rng.pick(defenders));

        // §7: a brawl is not a firing line. Somebody swinging into a press of
        // bodies, in the dark or with a bad arm, hits the wrong person — and
        // in a big enough fight that is a way to die that nobody chose.
        if (attackers.length >= COMBAT.friendlyFireMinAttackers
            && ctx.rng.chance(COMBAT.friendlyFireChance)) {
            // The clumsy one swings wide: low agility and a bad arm, not a
            // uniform draw over the pack.
            const swinger = weightedPick(ctx, attackers, a => 1
                + Math.max(0, SOCIAL_AXES.attributeMidpoint - effectiveAgility(a)) * COMBAT.friendlyFireAgilityWeight
                + injuryGrade(a, 'arms') * COMBAT.friendlyFireArmWeight);
            const hit = ctx.rng.pickOrUndefined(attackers.filter(a => a.id !== swinger.id));
            if (hit) {
                const stray = Math.round(COMBAT.friendlyFireDamage
                    * (ctx.state.timeOfDay === 'day' ? 1 : COMBAT.friendlyFireNightMultiplier));
                const cause = `Struck by ${swinger.name} in the confusion of a group fight`;
                applyDamage(ctx, hit, stray, { cause, kind: 'tribute', sourceId: swinger.id });
                adjustRel(hit, swinger.id, -COMBAT.friendlyFireRegard);
                ctx.logEvent(
                    `${swinger.name} swings into the press and catches ${hit.name} instead. `
                    + 'Everybody sees it. Nobody has time to say anything about it.',
                    [swinger.id, hit.id],
                    { important: true, category: 'combat' }
                );
                clampTribute(hit);
                checkDeath(ctx, hit, cause);
            }
        }

        const lead = attackers.reduce((best, a) =>
            (combatPower(ctx, a, bestWeapon(a)) > combatPower(ctx, best, bestWeapon(best)) ? a : best));
        // A pack fight feeds the same rivalry ledger a duel does — the pair
        // actually trading blows remember it, which is what rematch study,
        // feud escalation and the rematch prose are all keyed on.
        noteGroupFight(lead, target);
        const weapon = bestWeapon(lead);
        const edge = contestedPower(ctx, lead, weapon, Math.max(0, advantage), target)
            - contestedPower(ctx, target, bestWeapon(target), Math.max(0, -advantage), lead);

        if (attackers.length > 1) {
            ctx.logEvent(
                fill(ctx.pickText(GROUP_COMBAT_TEXTS.gangUp), {
                    attackers: attackers.map(a => a.name).join(' and '),
                    target: target.name,
                    zone,
                }),
                [...attackers.map(a => a.id), target.id],
                { important: true, category: 'combat' }
            );
        }

        if (edge > 0) {
            landHit(ctx, lead, target, edge, weapon);
            attackers.forEach(a => noteContact(ctx.state, a, target));
            if (target.health <= 0) {
                strikeDown(ctx, target, lead, weapon);
                continue;
            }
        } else {
            // The outnumbered side lands one anyway — desperation cuts.
            landHit(ctx, target, lead, -edge, bestWeapon(target));
            if (lead.health <= 0) {
                strikeDown(ctx, lead, target, bestWeapon(target));
                continue;
            }
        }

        // Focus fire is action economy, not just a power bonus: every
        // attacker beyond the lead presses the same target this round, each
        // at a flat penalty. Without this a six-strong pack dealt exactly one
        // blow per round — the same as a duel, only slightly harder — which
        // left the Career pack largely decorative.
        let targetDown = !isActive(target);
        for (const a of attackers) {
            if (targetDown || a.id === lead.id || !isActive(a)) continue;
            const supportWeapon = bestWeapon(a);
            const supportEdge = contestedPower(ctx, a, supportWeapon, 0, target)
                - contestedPower(ctx, target, bestWeapon(target), 0, a)
                - COMBAT.supportAttackPenalty;
            if (supportEdge <= 0) continue;
            noteGroupFight(a, target);
            landHit(ctx, a, target, supportEdge, supportWeapon);
            if (target.health <= 0) {
                strikeDown(ctx, target, a, supportWeapon);
                targetDown = true;
            }
        }
        if (targetDown) continue;

        // Anyone can break off, and being outnumbered is a good reason to.
        // The opponent each combatant weighs is whoever leads the *other* side
        // — not `lead` for everyone, which had the lead computing fear of
        // themselves.
        // §1.3: everyone weighs the *same* exchange that just happened, from
        // their own side of it. `edge` is the lead's advantage over the
        // target and already carries the numbers bonus, so the pack reads
        // `-edge` and the outnumbered side reads `+edge`. Anyone standing in
        // the zone who is on neither side of this particular exchange has no
        // differential to weigh and reads 0.
        const breaking = [...left, ...right].filter(t => {
            if (!isActive(t)) return false;
            const perceived = attackers.includes(t) ? -edge : defenders.includes(t) ? edge : 0;
            return wantsToRetreat(ctx, t, perceived, rounds, attackers.includes(t) ? target : lead);
        });
        if (breaking.length > 0) {
            breaking.forEach(t => forceStance(t, 'Evasive', 'broke off a fight'));
            ctx.logEvent(
                fill(ctx.pickText(breaking.length === 1 ? GROUP_COMBAT_TEXTS.scatterSolo : GROUP_COMBAT_TEXTS.scatter), { names: breaking.map(t => t.name).join(', '), zone }),
                breaking.map(t => t.id),
                { important: true, category: 'combat' }
            );
            // One skittish tribute on the periphery used to end the whole
            // engagement for everyone. Only the breakers leave; the brawl
            // carries on as long as both sides still have anyone in it.
            breaking.forEach(t => {
                const inPack = packSide.indexOf(t);
                if (inPack >= 0) packSide.splice(inPack, 1);
                const inOther = otherSide.indexOf(t);
                if (inOther >= 0) otherSide.splice(inOther, 1);
            });
        }
    }

    fighters.forEach(t => {
        if (t.status !== 'alive') return;
        addZoneThreat(ctx.state, t, zone, MEMORY.fightThreat);
        dropBrokenWeapons(t);
        // Everyone who swung at you is now someone you would rather not meet.
        fighters.forEach(other => {
            if (other.id === t.id) return;
            const sameSide = (origPack.has(t.id) && origPack.has(other.id)) || (origOther.has(t.id) && origOther.has(other.id));
            if (!sameSide) adjustRel(t, other.id, -COMBAT.grudgePerFight);
            // Standing in the same line as somebody is the clearest way to earn
            // their trust, and it is what romance is actually gated on. If they
            // were in real trouble and you were not, it is also a debt.
            else if (other.health < COMBAT.savedHealthThreshold && t.health > other.health) {
                incurDebt(other, t, DEBTS.savedInFight, ctx);
            } else {
                noteStoodBy(t, other.id);
                // AUDIT-7 §4.1: and the trust it earns. `stoodBy` is a set, so
                // the fact of it can only be said once; the stored axis is
                // where the fifth time somebody steps in front of you counts.
                adjustTrust(t, other.id, REL_KNOBS.trustStoodBy);
            }
        });
        checkDeath(ctx, t);
    });
}

/**
 * Everyone against everyone.
 *
 * The sides model assumes a brawl has two of them. When three or more tributes
 * who all dislike each other meet — which is exactly what a feast produces —
 * there is no coalition to draw, and pretending otherwise handed one of them a
 * numbers advantage decided by nothing but array order.
 */
function resolveFreeForAll(ctx: SimContext, fighters: Tribute[], zone: string) {
    ctx.logEvent(
        `${fighters.map(f => f.name).join(', ')} all reach ${zone} at once, and not one of them has a friend in it. ` +
        `It comes apart into every-tribute-for-themselves.`,
        fighters.map(f => f.id),
        { important: true, category: 'combat' }
    );

    const withdrawn = new Set<string>();
    let rounds = 0;
    while (rounds < COMBAT.maxGroupRounds) {
        rounds++;
        const standing = fighters.filter(t => isActive(t) && t.zone === zone && !withdrawn.has(t.id));
        if (standing.length < 2) break;

        // Each round, one pairing resolves — weighted toward whoever is most
        // dangerous picking whoever is most vulnerable, which is how a
        // free-for-all actually collapses.
        //
        // Weighted, not decided. This used to be two `reduce`s: the single
        // highest combat power always swung, always at the single lowest
        // health, with no roll anywhere — the only combat path in the engine
        // with no variance in it at all, while the duel and the group brawl
        // both roll. A feast full of people who all hate each other should not
        // resolve like a sorting algorithm.
        const attacker = weightedPick(ctx, standing, t =>
            Math.max(0.1, combatPower(ctx, t, bestWeapon(t))));
        // Lovers never turn on each other, and a standing truce holds in the
        // melee the same way it does anywhere else.
        const targets = standing.filter(t =>
            t.id !== attacker.id && !areLovers(attacker, t) && !hasTruce(ctx.state, attacker, t.id)
            && !blocTreatyHolds(ctx, attacker, t));
        if (targets.length === 0) break;
        // The wounded are still likeliest to draw the blow — a hurt tribute is
        // the obvious opening — but "likeliest" is now a weight rather than a
        // certainty, and a sworn grudge outranks pure opportunism.
        const target = weightedPick(ctx, targets, t =>
            Math.max(COMBAT.minFocusWeight,
                Math.max(1, 100 - t.health)
                + targetDrawOf(t)
                + (hasVengeanceAgainst(attacker, t.id) ? COMBAT.freeForAllVengeanceWeight : 0)));

        noteFight(ctx.state, attacker, target);
        const weapon = bestWeapon(attacker);
        const edge = contestedPower(ctx, attacker, weapon, 0, target)
            - contestedPower(ctx, target, bestWeapon(target), 0, attacker);
        if (edge > 0) {
            landHit(ctx, attacker, target, edge, weapon);
            if (target.health <= 0) { strikeDown(ctx, target, attacker, weapon); continue; }
        } else {
            landHit(ctx, target, attacker, -edge, bestWeapon(target));
            if (attacker.health <= 0) { strikeDown(ctx, attacker, target, bestWeapon(target)); continue; }
        }

        // §1.3: same convention as the pack brawl. The two who actually traded
        // blows weigh the differential they just felt; a bystander scattering
        // out of the melee was not in a fight and has none to weigh.
        const breaking = standing.filter(t => {
            if (!isActive(t)) return false;
            const perceived = t.id === attacker.id ? -edge : t.id === target.id ? edge : 0;
            return wantsToRetreat(ctx, t, perceived, rounds, t.id === attacker.id ? target : attacker);
        });
        if (breaking.length > 0) {
            breaking.forEach(t => {
                forceStance(t, 'Evasive', 'broke off a fight');
                // Only the pair who actually traded blows record who they fled
                // from; a bystander scattering out of the melee was not in a
                // fight with either of them.
                if (t.id === attacker.id) noteFled(t, target.id);
                else if (t.id === target.id) noteFled(t, attacker.id);
            });
            ctx.logEvent(
                fill(ctx.pickText(breaking.length === 1 ? GROUP_COMBAT_TEXTS.scatterSolo : GROUP_COMBAT_TEXTS.scatter), { names: breaking.map(t => t.name).join(', '), zone }),
                breaking.map(t => t.id),
                { important: true, category: 'combat' }
            );
            // Only the breakers leave the melee; whoever still wants it keeps
            // fighting. Ending the whole free-for-all on the first tribute to
            // flinch let one skittish twelve-year-old call the fight off for
            // everyone.
            breaking.forEach(t => withdrawn.add(t.id));
        }
    }

    fighters.forEach(t => {
        if (t.status !== 'alive') return;
        addZoneThreat(ctx.state, t, zone, MEMORY.fightThreat);
        dropBrokenWeapons(t);
        fighters.forEach(other => {
            if (other.id === t.id) return;
            adjustRel(t, other.id, -COMBAT.grudgePerFight);
        });
        checkDeath(ctx, t);
    });
}

/**
 * §(requests 1): `silent` exists because some callers have already narrated
 * the death in their own words.
 *
 * `downed.ts` writes the line about dying in a rescuer's hands and `resolve.ts`
 * writes the nightlock and border-walk lines, and then both called into here,
 * which announced the same death a second time out of the generic pool. Two
 * red lines, one cannon. The caller that has the better sentence keeps it.
 */
export function killTribute(ctx: SimContext, victim: Tribute, killer?: Tribute, opts: { weapon?: Item; cause?: string; silent?: boolean } = {}) {
    const { weapon, cause, silent } = opts;
    if (victim.status === 'dead') return;
    victim.status = 'dead';
    // Carry capacity can shrink under a tribute — losing the Backpack is the
    // usual way — and only the per-cycle upkeep in `dayNight` repairs the
    // overflow. A tribute who dies in between freezes that violation in place
    // forever, which is how a corpse ends up holding six weapons on a capacity
    // of five. Settle it here, at the last moment the body is still theirs.
    enforceCapacity(victim);
    victim.health = 0;
    victim.dayOfDeath = ctx.state.day;
    /*
     * AUDIT-9 B16: the elimination *order*, which nothing recorded.
     *
     * `killTribute` is the one funnel every death goes through — combat,
     * hazards, the border, starvation, the downed window and self-inflicted
     * deaths all arrive here — so this is the only place the sequence can be
     * captured without threading a counter through a dozen subsystems.
     */
    ctx.state.eliminations = (ctx.state.eliminations ?? 0) + 1;
    victim.eliminationIndex = ctx.state.eliminations;

    // §9.1: the obituary and the damage record have to agree, and one path
    // could not make them agree on its own.
    //
    // `strikeDown` finishes a tribute who is *already* in the rescue window by
    // calling straight through to here, so the victim still carried the record
    // of whoever put them on the ground. A tribute knocked down by friendly
    // fire and then killed by somebody else read back as "Killed by Lavender
    // (Sword)" with `lastDamage.sourceId` pointing at Sequoia — the obituary,
    // the kill credit and the soak's attribution invariant disagreeing three
    // ways about the same death. `finish` in downed.ts already does this
    // reconciliation for the endings `tickDowned` owns; this is the same move
    // for the ending combat owns, at the one funnel every death goes through.
    //
    // Narrow on purpose: when the record already names the killer — which is
    // every ordinary kill, because `applyDamage` wrote it moments ago — this
    // is a no-op. The marker goes with it: a corpse is not in a rescue window.
    if (killer && victim.lastDamage?.sourceId !== killer.id) {
        victim.lastDamage = {
            cause: cause
                || (weapon ? `Killed by ${killer.name} (${weapon.name})` : `Killed by ${killer.name}`),
            kind: 'tribute',
            sourceId: killer.id,
            cycle: cycleOf(ctx.state),
            amount: victim.lastDamage?.amount ?? 0,
        };
    }
    delete victim.downed;

    // Audit 5 §5.4 `salvage`: the dead are not collected. Their kit stays where
    // they fell, as a cache the abandoned-camp pass will hand to whoever
    // arrives — which turns every cannon into a map reference.
    if (arenaHasLaw(ctx.state, 'salvage') && victim.inventory.length > 0) {
        const kept = victim.inventory.filter(() => ctx.rng.chance(ARENA_LAWS.salvageKeepChance));
        if (kept.length > 0) {
            ctx.state.abandonedCamps = ctx.state.abandonedCamps ?? [];
            if (!ctx.state.abandonedCamps.some(c => c.zone === victim.zone && c.foundBy === undefined)) {
                ctx.state.abandonedCamps.push({ zone: victim.zone, ownerId: victim.id, ownerName: victim.name, cycle: cycleOf(ctx.state), items: kept.map(i => i.id) });
                ctx.logEvent(`Nobody comes for ${victim.name}. What they were carrying stays in ${victim.zone}, and the whole arena heard where.`, [victim.id], { category: 'loot', zone: victim.zone });
            }
        }
    }

    // A2: a Diplomat's death dissolves every truce they talked other people
    // into. The agreements were only ever held together by them being there.
    dissolveBrokeredTruces(ctx, victim);

    // A corpse is not part of an alliance; leaving the id set kept dead
    // tributes in the alliance roster and skewed betrayal targeting.
    //
    // The teardown itself is deferred to `dissolveVictimAlliance` below, after
    // the fallout has been propagated. It used to run here, 139 lines before
    // `propagateDeathFallout`, which reads exactly the fields it clears:
    //
    //   const wereAllied = other.allianceId !== undefined && other.allianceId === victim.allianceId;
    //   const isLover = areLovers(other, victim);
    //
    // With the victim's id already deleted, `wereAllied` required
    // `other.allianceId !== undefined` to equal `undefined` and so could never
    // be true; and for a two-person bond the survivor's id was deleted too, so
    // `areLovers` — which matches on a `lovers-<a>-<b>` alliance id held by
    // either party — could not be true either. Measured over 120 complete runs
    // before this change: that branch executed zero times, the lover TRAGEDY
    // beat fired zero times across 19 runs that had a live pair, and `Haunted`
    // (whose only grant site is that branch) was never once awarded — which
    // also made `Hollow`, six cycles of Haunted, unreachable by construction.
    //
    // `inheritFrom` reads it too, so an ally could only inherit by clearing the
    // bond threshold and never by membership.
    const formerAlliance = victim.allianceId;
    // Captured before the cleanup below: killing your last remaining ally
    // dissolves the alliance and strips the killer's id, which made the
    // ally-kill sanity toll unreachable for two-person alliances.
    const killerWasAllied = !!formerAlliance && killer?.allianceId === formerAlliance;

    if (killer) {
        const killerAlive = killer.status === 'alive';
        if (killerAlive) killer.kills += 1;
        // §11.6: the object remembers, whoever is holding it next.
        if (killerAlive) bloodOnTheBlade(ctx, weapon, killer);
        // §6.8: the first tribute-dealt kill of the Games — the side-bet book
        // settles 'first blood' off this.
        if (ctx.state.firstBloodId === undefined) ctx.state.firstBloodId = killer.id;
        // AUDIT-9 (audit B20): and the other end of the same thread. Written
        // unconditionally, so at the epilogue it names whoever killed last.
        ctx.state.lastKillerId = killer.id;
        victim.causeOfDeath = cause
            || (weapon ? `Killed by ${killer.name} (${weapon.name})` : `Killed by ${killer.name}`);

        const weaponType = weapon ? weapon.id : 'unarmed';
        const templates = WEAPON_KILL_TEMPLATES[weaponType] || WEAPON_KILL_TEMPLATES['unarmed'];
        const template = ctx.pickText(templates);
        // split/join, not replace: `replace` with a string pattern only
        // substitutes the FIRST match, so templates naming {victim} twice
        // printed a raw placeholder into the feed.
        // §11.5: once the country has a name for somebody, the feed uses it.
        const text = template
            .split('{killer}').join(displayName(killer))
            .split('{victim}').join(displayName(victim));

        // Everything below only matters for a killer who is still around to
        // feel it, carry loot, or wear out gear.
        if (killerAlive) {
            addExcitement(killer, 20);
            // Bloodlust: briefly stronger and far less willing to break off.
            killer.momentum = Math.min(HUNTING.momentumMax, (killer.momentum ?? 0) + HUNTING.momentumPerKill);

            // What it costs them. `killSanity` is a multiplier offset on the
            // base toll, so Ruthless barely notices, a Pacifist comes apart,
            // and everything between is a row in the trait table.
            const baseToll = killer.isCareer ? COMBAT.careerKillSanity : COMBAT.killSanity;
            const toll = Math.max(0, baseToll * Math.max(0, 1 + traitMod(killer, 'killSanity')));
            loseSanity(killer, toll);
            if (toll >= COMBAT.killSanityBreakdown) {
                ctx.logEvent(
                    `${killer.name} stares at what they have done and cannot stop shaking. This is not who they were.`,
                    [killer.id],
                    { category: 'sanity' }
                );
            }
            // Killing someone you were allied with is its own kind of wound.
            if (killerWasAllied) {
                loseSanity(killer, COMBAT.killAllySanity);
            }
            // Vengeance discharged.
            const mem = ensureMemory(killer);
            if (mem.vengeance.includes(victim.id)) {
                mem.vengeance = mem.vengeance.filter(id => id !== victim.id);
                killer.vitals.sanity = Math.min(100, killer.vitals.sanity + COMBAT.vengeanceSanityRelief);
                addExcitement(killer, COMBAT.vengeanceExcitement);
                // §(requests 1): the discharge is about the killer's head, not
                // a second announcement of the death. Off the red channel.
                ctx.logEvent(
                    `${killer.name} settles the debt. ${victim.name} is dead, and whatever was driving ${killer.name} goes quiet.`,
                    [killer.id, victim.id],
                    { important: true, category: 'sanity' }
                );
            }

            // The arc: the first one changes you, and enough of them changes
            // how the rest of the arena talks about you.
            if (killer.kills === 1) earnTrait(ctx, killer, 'Bloodied');
            if (killer.kills >= HUNTING.fearedAtKills) earnTrait(ctx, killer, 'Feared');

            if (weapon && weapon.durability !== undefined) weapon.durability -= 10;

            clampTribute(killer);

            /*
             * §(requests): going through a body is a decision, not a reflex.
             *
             * Every kill stripped the corpse, automatically, every time — so a
             * wounded tribute who had just fought for their life in an open
             * zone with two other people converging on it calmly knelt and
             * inventoried a pack, and the feed reported it. Two things were
             * missing: whether they had the *time*, and whether they had the
             * stomach.
             *
             * Time is the arena's own answer — other living tributes in the
             * zone, or bleeding badly enough that standing still is the worse
             * option. Stomach is disposition: an archetype's aggression, the
             * `scavenge` trait modifier, and how badly they need something.
             * A tribute with nothing and a corpse with a pack takes the risk;
             * a well-supplied Career with a rival in the treeline does not
             * bother, and the kit stays where it fell for whoever comes next —
             * which is what the abandoned-camp layer is for.
             */
            const onlookers = ctx.state.tributes.filter(o =>
                o.status === 'alive' && o.id !== killer.id && o.id !== victim.id
                && o.zone === victim.zone && o.allianceId !== killer.allianceId).length;
            const desperate = killer.inventory.length === 0
                || killer.vitals.hunger > LOOTING.desperateHunger
                || killer.vitals.thirst > LOOTING.desperateThirst;
            let lootChance = LOOTING.baseChance
                + ARCHETYPES[killer.archetype].aggression * LOOTING.perAggression
                + traitMod(killer, 'scavenge')
                + (desperate ? LOOTING.desperateBonus : 0)
                - onlookers * LOOTING.perOnlooker
                - (killer.injuries.bleeding ? LOOTING.bleedingPenalty : 0);
            // Their own district partner is not a body to be gone through,
            // whatever else the arena has made of them.
            if (killer.district === victim.district) lootChance -= LOOTING.districtPartnerPenalty;
            const loots = ctx.rng.chance(Math.max(0, Math.min(1, lootChance)));

            if (victim.inventory.length > 0 && !loots) {
                if (!silent) {
                    ctx.logEvent(
                        `${text} ${killer.name} does not stay to go through what ${victim.name} was carrying — `
                        + (onlookers > 0
                            ? 'there is somebody else in the zone, and the pack is not worth being found over.'
                            : 'they take one look at the pack, and then at their own hands, and walk.'),
                        [killer.id, victim.id],
                        { important: true, category: 'kill' },
                    );
                }
            } else if (victim.inventory.length > 0) {
                const spoils = victim.inventory;
                victim.inventory = [];
                // §8.9: stripping the fallen, done often enough, becomes who
                // you are on camera.
                killer.corpsesLooted = (killer.corpsesLooted ?? 0) + 1;
                if (killer.corpsesLooted >= EARNED_TRAIT_RULES.vultureCorpses) earnTrait(ctx, killer, 'Vulture');
                const dropped = giveItem(killer, ...spoils);
                const taken = spoils.filter(i => !dropped.includes(i));
                const lootNames = taken.map(i => i.name).join(', ');
                // A caller that narrated the death still reports the looting —
                // it is a different fact — but without repeating the killing.
                const opener = silent ? `${killer.name} goes through what ${victim.name} was carrying.` : text;
                if (dropped.length > 0) {
                    ctx.logEvent(
                        `${opener} ${killer.name} takes what they can carry — ${lootNames || 'nothing they can use'} — and leaves ${dropped.map(i => i.name).join(', ')} in the dirt.`,
                        [killer.id, victim.id],
                        {
                            important: !silent, category: silent ? 'loot' : 'kill',
                            // AUDIT-9 B18: kill credit from an id, not from
                            // list position.
                            actorId: killer.id,
                            // §(requests): the record states the method and
                            // the goods; the prose above states the scene.
                            fact: `${killer.name} killed ${victim.name} (${weapon?.name ?? 'unarmed'}); took ${lootNames || 'nothing'}, left ${dropped.map(i => i.name).join(', ')}`,
                        }
                    );
                } else {
                    ctx.logEvent(
                        `${opener} ${killer.name} strips the body: ${lootNames}.`,
                        [killer.id, victim.id],
                        {
                            important: !silent, category: silent ? 'loot' : 'kill',
                            // AUDIT-9 B18: kill credit from an id, not from
                            // list position.
                            actorId: killer.id,
                            fact: `${killer.name} killed ${victim.name} (${weapon?.name ?? 'unarmed'}); took ${lootNames}`,
                        },
                    );
                }
            } else if (!silent) {
                ctx.logEvent(text, [killer.id, victim.id], {
                    important: true, category: 'kill', actorId: killer.id,
                    fact: `${killer.name} killed ${victim.name} (${weapon?.name ?? 'unarmed'})`,
                });
            }
        } else if (!silent) {
            ctx.logEvent(text, [killer.id, victim.id], {
                important: true, category: 'kill', actorId: killer.id,
                fact: `${killer.name} killed ${victim.name} (${weapon?.name ?? 'unarmed'})`,
            });
        }
    } else {
        victim.causeOfDeath = cause || victim.lastDamage?.cause || 'Died to environment';
        const witness = ctx.state.tributes.find(o =>
            o.status === 'alive' && o.id !== victim.id && o.zone === victim.zone);
        const pool = pickEnvironmentalDeathPool(victim, witness);
        const template = ctx.pickText(pool);
        const text = template
            .split('{tribute}').join(victim.name)
            .split('{zone}').join(victim.zone)
            .split('{cause}').join(victim.causeOfDeath)
            .split('{age}').join(String(victim.age))
            .split('{witness}').join(witness?.name ?? 'someone nearby');
        if (!silent) {
            ctx.logEvent(text, witness ? [victim.id, witness.id] : [victim.id], {
                important: true, category: 'death',
                // §(requests): the record carries the cause code, not the
                // sentence that dressed it. `causeOfDeath` is the same string
                // the obituary and every measurement already read.
                fact: `${victim.name} died — ${victim.causeOfDeath}`,
            });
        }
    }

    /*
     * AUDIT-9: the structured cause, recorded once, here.
     *
     * Placed after both branches above have settled `causeOfDeath`, so it
     * classifies the obituary the run actually wrote rather than an
     * intermediate value. Everything that measures deaths — the metrics death
     * table, the soak's attribution invariant, a dozen achievements, the
     * epilogue and the notables — reads this instead of re-deriving it from
     * the prose with a regex of its own.
     */
    victim.causeCode = classifyCause(victim.causeOfDeath, victim.lastDamage?.kind);
    if (victim.lastDamage?.code) victim.causeCode = victim.lastDamage.code;

    // §6.9: the district token goes home with the body. The cameras do not
    // always find it, but when they do it is the shot of the night. Selection
    // is deterministic from the death itself rather than an rng draw — a
    // per-kill draw here would shift every roll downstream of every kill,
    // which perturbs the whole run for the sake of one flavour line.
    // §(requests 1): the hovercraft shot is a broadcast beat about a token
    // going home, not the announcement of a death. It was the second red line
    // on every death that happened to have one.
    if (victim.token && (victim.district + ctx.state.day + victim.age) % 4 === 0) {
        ctx.logEvent(
            `The hovercraft lifts ${victim.name} with their district token still on them — ${victim.token}. District ${victim.district} sent it out with them, and District ${victim.district} gets it back.`,
            [victim.id],
            { category: 'system' }
        );
    }

    // Watching someone kill is the single most frightening thing that can
    // happen to a tribute, and it attaches to that person, not to the zone.
    if (killer) {
        ctx.state.tributes.forEach(witness => {
            if (witness.status !== 'alive' || witness.id === killer.id || witness.id === victim.id) return;
            if (witness.zone !== victim.zone) return;
            addFear(witness, killer.id, FEAR.witnessedKill);
        });
    }

    // Everything a cannon does to everyone still breathing. Both of these read
    // the victim's alliance membership — `broadcastDeath` for the ally-kill
    // suspicion it raises, `propagateDeathFallout` for grief grading, the lover
    // beat, vengeance and inheritance — so the teardown waits until they have
    // both had it.
    broadcastDeath(ctx, victim, killer);
    propagateDeathFallout(ctx, victim, killer);

    // Audit 3 §4.3: killing the quartermaster costs the group its supplies.
    //
    // The role was described as "the obvious knife target" and its removal did
    // nothing at all — the cache sat in the alliance record and the next member
    // drew from it exactly as before, so the description was a caption rather
    // than a strategy. The one who carried it was carrying it: what is left is
    // scattered where they fell, for whoever comes through next.
    if (formerAlliance) {
        const record = ctx.state.alliances?.[formerAlliance];
        /*
         * AUDIT-7 §4.2: the runner carries it too.
         *
         * `types.ts` describes the role as "carries the cache — `contributeToCache`
         * had no owner at all, so a group's supplies belonged to everybody and
         * therefore to nobody". The quartermaster *decides* about the cache
         * (they are the betrayal weight and the political object); the runner
         * is the one physically carrying it. Killing either scatters it, which
         * is what makes a group of five have two people worth killing for their
         * job rather than one.
         */
        const carrier = record?.roles?.quartermaster === victim.id ? 'quartermaster'
            : record?.roles?.runner === victim.id ? 'runner'
            : undefined;
        if (record && carrier && record.sharedCache.length > 0) {
            const scattered = emptyCache(record);
            delete record.roles![carrier];
            ctx.state.abandonedCamps = ctx.state.abandonedCamps ?? [];
            ctx.state.abandonedCamps.push({
                zone: victim.zone,
                ownerId: victim.id,
                ownerName: victim.name,
                cycle: cycleOf(ctx.state),
                items: scattered.map(i => i.id),
            });
            ctx.logEvent(
                `${victim.name} was carrying everything the group had. It is in ${victim.zone} now, in the open, `
                + `and whoever comes through next will find ${scattered.map(i => i.name).join(', ')} before any of them get back to it.`,
                [victim.id],
                { important: true, category: 'alliance', zone: victim.zone }
            );
        }
    }

    // Only now is the body out of the roster.
    if (formerAlliance) {
        delete victim.allianceId;
        const remaining = ctx.state.tributes.filter(t => t.status === 'alive' && t.allianceId === formerAlliance);
        if (remaining.length < 2) remaining.forEach(m => delete m.allianceId);
    }

    // Feeds the `scavenger` mutt role: only eligible where a cannon just
    // fired. Pruned to the current cycle each time so this never grows
    // unbounded across a long run.
    const cycle = cycleOf(ctx.state);
    ctx.state.recentCannonZones = (ctx.state.recentCannonZones ?? [])
        .filter(c => c.cycle === cycle)
        .concat({ zone: victim.zone, cycle });

    // 'The Bounty Quell': collecting the named quarry is a standing sponsor
    // stream, not a one-off gift — maintainBounty (dayNight.ts) names a new
    // quarry as soon as this one drops.
    if (killer && ctx.state.quellBounty?.targetId === victim.id) {
        killer.sponsorTrust = Math.min(100, killer.sponsorTrust + QUELL_MECHANICS.bountySponsorTrustBonus);
        ctx.logEvent(
            `${killer.name} collects the bounty on ${victim.name}. Every sponsor purse in the Capitol opens for them at once.`,
            [killer.id],
            { important: true, category: 'sponsor' }
        );
    }
}
