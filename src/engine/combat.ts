import { DamageRecord, Item, Tribute } from '../models/types';
import { SimContext } from './context';
import { WEAPON_KILL_TEMPLATES, DEATH_TEXTS, DUEL_TEXTS, GROUP_COMBAT_TEXTS } from '../data/flavorText';
import { ARCHETYPES } from '../data/archetypes';
import { BLEEDING, COMBAT, DEBTS, ESCALATION, FEAR, HUNTING, INVENTORY, MEMORY, PROFICIENCY, QUALITY, QUELL_MECHANICS, RIVALRY, STEALTH } from '../data/balance';
import { clampTribute } from './vitals';
import { giveItem } from './items';
import { rollAmbush } from './stealth';
import { getZone, zoneFeatures } from './map';
import { addZoneThreat, broadcastDeath, cycleOf, ensureMemory, hasVengeanceAgainst, noteContact, noteFight, noteFled, noteStoodBy, noteWound } from './memory';
import { incurDebt } from './debts';
import { adjustRel, getRel, propagateDeathFallout } from './relationships';
import { injure, injuryGrade, openWound } from './wounds';
import { profOf, trainProficiency, weaponAffinity, weaponProficiency } from './proficiency';
import { addFear, fearFraction, reduceFear } from './fear';
import { areLovers } from './alliance';
import { hasTruce } from './parley';
import { reachBonus } from './physique';
import { addExcitement } from './audience';
import { traitMod } from '../data/traits';
import { earnTrait } from './earnedTraits';
import { PREGAMES } from '../data/balance';
import { armourOf, effectiveDamage, encumbranceOf, wearArmour } from './items';

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

function bestWeapon(t: Tribute): Item | undefined {
    const weapons = t.inventory.filter(i => i.type === 'weapon');
    if (weapons.length === 0) return undefined;
    // Condition counts: a battered sword can be the worse choice than a fresh knife.
    return weapons.reduce((best, w) => (effectiveDamage(w) > effectiveDamage(best) ? w : best));
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
        if (amount <= 0) return finalistSave;
    }

    t.health -= amount;
    t.lastDamage = { ...record, cycle: cycleOf(ctx.state), amount };
    clampTribute(t);
    return finalistSave;
}

/** Kills the tribute if the last wound finished them, attributing it correctly. */
export function checkDeath(ctx: SimContext, t: Tribute, fallbackCause?: string) {
    if (t.health > 0 || t.status !== 'alive') return;
    const record = t.lastDamage;
    // Aliveness decides whether the killer gets credit for the kill, not
    // whether they get credit for the wound — a mutual kill still has a true
    // obituary even though the killer dropped in the same exchange.
    const killer = record?.sourceId
        ? ctx.state.tributes.find(o => o.id === record.sourceId)
        : undefined;
    if (killer) {
        killTribute(ctx, t, killer, { cause: record?.cause });
    } else {
        killTribute(ctx, t, undefined, { cause: record?.cause || fallbackCause });
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

function combatPower(ctx: SimContext, t: Tribute, weapon?: Item, allies = 0, opponent?: Tribute): number {
    let power = effectiveStrength(t) + t.attributes.agility + ctx.rng.nextInt(0, 5);

    if (weapon) {
        power += weapon.damage !== undefined ? effectiveDamage(weapon) : weapon.value / 10;
        // Ranged weapons reward agility; melee rewards raw strength
        // Every weapon class scales with something. 'thrown' had no branch at
        // all, so Throwing Knives and the Spear — the one weapon a tribute can
        // craft mid-run — were the only weapons in the game with no stat
        // scaling behind them, which made crafting a downgrade.
        if (weapon.weaponClass === 'ranged') {
            power += Math.floor(t.attributes.agility / COMBAT.rangedAgilityDivisor) + traitMod(t, 'rangedPower');
        } else if (weapon.weaponClass === 'melee') {
            power += Math.floor(effectiveStrength(t) / COMBAT.meleeStrengthDivisor) + traitMod(t, 'meleePower');
            // Reach: a long-armed tribute lands first in a melee. `heightCm` was
            // generated with care and then read only by display code.
            power += reachBonus(t);
        } else if (weapon.weaponClass === 'thrown') {
            // Throwing wants both the arm behind it and the eye in front of it.
            power += Math.floor(effectiveStrength(t) / COMBAT.thrownStrengthDivisor)
                + Math.floor(t.attributes.agility / COMBAT.thrownAgilityDivisor)
                + traitMod(t, 'rangedPower') * 0.5 + traitMod(t, 'meleePower') * 0.5;
        }
        // Practice with the class of weapon actually in their hands.
        power += profOf(t, weaponProficiency(weapon.weaponClass)) * PROFICIENCY.combatWeight;
        // And familiarity with this *particular* weapon, from home rather than
        // from the training centre. A trident is a fishing tool to District 4
        // and an awkward three-pronged spear to everybody else.
        power += weaponAffinity(t, weapon);
    } else {
        // Bare hands are a grapple, and a grapple is decided by mass, reach and
        // whether they have ever done this before.
        power += reachBonus(t) + traitMod(t, 'unarmedPower');
    }
    power += traitMod(t, 'combatPower');

    // Archetype edge: aggressive fighters commit harder
    power += ARCHETYPES[t.archetype].aggression * 4;

    // Injury and status penalties
    // T-5: a shattered arm is not a bruised one — penalties scale with grade.
    power -= injuryGrade(t, 'arms') * COMBAT.limbPowerPenaltyPerGrade;
    power -= injuryGrade(t, 'legs') * COMBAT.limbPowerPenaltyPerGrade;
    if (t.injuries.poisoned) power -= 3;
    if (t.injuries.burned) power -= 1;
    if (t.injuries.frostbitten) power -= 2;
    if (t.vitals.fatigue > 80) power -= 2;
    // A wrecked tribute fights like one.
    power -= (100 - t.health) / 22;
    // §3.3: a pack laden with the horn's contents is slower where it counts.
    power -= encumbranceOf(t) * INVENTORY.encumbrancePowerPenaltyMax;

    // Numbers advantage: the whole point of a pack.
    power += Math.min(COMBAT.outnumberMaxBonus, allies * COMBAT.outnumberPowerPerAlly);

    // Bloodlust. A tribute who has just killed is keyed up and dangerous — this
    // is what lets a hunter snowball instead of every fight starting from zero.
    power += (t.momentum ?? 0) * HUNTING.momentumPowerWeight;
    // §3.4: a shaken tribute fights below their numbers.
    power -= (t.rattled ?? 0) * HUNTING.rattledPowerWeight;

    // What they have learned from losing to this person before.
    power += rematchEdge(t, opponent);

    // Vengeful is not a general combat bonus — it is a bonus against the
    // specific person they cannot let go of.
    if (opponent && t.traits.includes('Vengeful')
        && (hasVengeanceAgainst(t, opponent.id) || getRel(t, opponent.id) <= -35)) {
        power += COMBAT.vengefulEdge;
    }

    return power;
}

/** Per-round retreat check. Nobody has to fight to the death. */
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

    const arch = ARCHETYPES[t.archetype];
    const healthFraction = t.health / 100;
    if (healthFraction <= COMBAT.routHealthFraction) return true;

    let chance = COMBAT.retreatBase
        + (1 - healthFraction) * COMBAT.retreatPerHealthLost
        + arch.caution * COMBAT.retreatCautionWeight
        - arch.aggression * COMBAT.retreatAggressionWeight
        + Math.max(0, 17 - t.age) * COMBAT.retreatYouthWeight
        + roundsFought * 0.05;

    if (opponentEdge > 0) chance += COMBAT.retreatLosingBonus;
    chance += traitMod(t, 'retreat');
    if (t.isCareer) chance -= 0.1;
    if (t.stance === 'Aggressive') chance -= 0.12;
    if (t.stance === 'Evasive') chance += 0.15;
    // Who they are fighting, not just how badly it is going: a tribute who has
    // watched this particular person kill wants out long before the numbers say so.
    if (opponent) chance += fearFraction(t, opponent.id) * FEAR.retreatWeight;
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
function landHit(ctx: SimContext, attacker: Tribute, defender: Tribute, edge: number, weapon?: Item, multiplier = 1) {
    const raw = (COMBAT.baseHitDamage + edge * COMBAT.damagePerPowerPoint + ctx.rng.nextInt(-3, 4)) * multiplier;
    const damage = Math.round(Math.max(COMBAT.minRoundDamage, Math.min(COMBAT.maxRoundDamage * multiplier, raw)));

    applyDamage(ctx, defender, damage, {
        cause: weapon ? `Killed by ${attacker.name} (${weapon.name})` : `Killed by ${attacker.name}`,
        sourceId: attacker.id,
        kind: 'tribute',
    });

    if (ctx.rng.chance(COMBAT.bleedChance)) openWound(defender, BLEEDING.combatSeverity);
    if (ctx.rng.chance(COMBAT.woundChance)) {
        const site = ctx.rng.pick(['head', 'torso', 'arms', 'legs'] as const);
        injure(defender, site);
    }
    // A Pyromaniac fights dirty with whatever burns — every landed hit has a
    // real chance to leave the defender scorched, not just bruised.
    if (attacker.traits.includes('Pyromaniac') && !defender.injuries.burned && ctx.rng.chance(COMBAT.pyromaniacBurnChance)) {
        injure(defender, 'burned');
        ctx.logEvent(
            `${attacker.name}'s strike leaves ${defender.name} scorched — Pyromaniacs make sure something is always burning.`,
            [defender.id, attacker.id],
            { category: 'injury' }
        );
    }
    if (weapon?.poison && ctx.rng.chance(COMBAT.poisonTransferChance) && !defender.injuries.poisoned) {
        injure(defender, 'poisoned');
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
    // §3.2: and landing one on somebody you had only heard stories about is
    // how you learn the stories were bigger than the person.
    reduceFear(attacker, defender.id, FEAR.realityCorrection);
    if (weapon) trainProficiency(attacker, weaponProficiency(weapon.weaponClass));
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

    // Star-crossed lovers refuse to fight each other!
    if (areLovers(t1, t2)) {
        ctx.logEvent(`${t1.name} and ${t2.name} refuse to fight each other due to their deep bond as star-crossed lovers.`, [t1.id, t2.id], { category: 'romance' });
        return;
    }

    noteContact(ctx.state, t1, t2);
    noteFight(ctx.state, t1, t2);
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
        const opener = bestWeapon(t1);
        const damage = landHit(ctx, t1, t2, STEALTH.ambushPowerBonus, opener, STEALTH.ambushDamageMultiplier);
        ctx.logEvent(
            fill(ctx.pickText(DUEL_TEXTS.ambush), { attacker: t1.name, victim: t2.name, zone: t1.zone }),
            [t1.id, t2.id],
            { important: true, category: 'combat' }
        );
        if (t2.health <= 0) {
            killTribute(ctx, t2, t1, { weapon: opener });
            [t1, t2].forEach(t => { if (t.status === 'alive') dropBrokenWeapons(t); });
            return;
        }
        // Being jumped is a reason to leave, not to settle in.
        if (noRetreatRounds < 1 && wantsToRetreat(ctx, t2, damage / 10, 1, t1)) {
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

    const maxRounds = isBloodbath ? COMBAT.maxRounds + COMBAT.bloodbathExtraRounds : COMBAT.maxRounds;
    let round = 0;
    let ended = false;

    while (round < maxRounds && t1.status === 'alive' && t2.status === 'alive') {
        round++;
        const w1 = bestWeapon(t1);
        const w2 = bestWeapon(t2);
        const p1 = combatPower(ctx, t1, w1, 0, t2);
        const p2 = combatPower(ctx, t2, w2, 0, t1);
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
                killTribute(ctx, loser, winner, { weapon });
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
                    killTribute(ctx, fleer, stayer, { weapon: parting });
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

    if (!ended && t1.status === 'alive' && t2.status === 'alive') {
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
    const fighters = participants.filter(t => t.status === 'alive');
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
    const isBonded = (a: Tribute, b: Tribute) =>
        areLovers(a, b) || hasTruce(ctx.state, a, b.id);
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
        { important: true, category: 'combat' }
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
        const left = packSide.filter(t => t.status === 'alive' && t.zone === zone);
        const right = otherSide.filter(t => t.status === 'alive' && t.zone === zone);
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
        const target = sworn ?? (ctx.rng.chance(COMBAT.focusFireChance)
            ? defenders.reduce((weak, d) => (d.health < weak.health ? d : weak))
            : ctx.rng.pick(defenders));

        const lead = attackers.reduce((best, a) =>
            (combatPower(ctx, a, bestWeapon(a)) > combatPower(ctx, best, bestWeapon(best)) ? a : best));
        // A pack fight feeds the same rivalry ledger a duel does — the pair
        // actually trading blows remember it, which is what rematch study,
        // feud escalation and the rematch prose are all keyed on.
        noteGroupFight(lead, target);
        const weapon = bestWeapon(lead);
        const edge = combatPower(ctx, lead, weapon, Math.max(0, advantage), target)
            - combatPower(ctx, target, bestWeapon(target), Math.max(0, -advantage), lead);

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
                killTribute(ctx, target, lead, { weapon });
                continue;
            }
        } else {
            // The outnumbered side lands one anyway — desperation cuts.
            landHit(ctx, target, lead, -edge, bestWeapon(target));
            if (lead.health <= 0) {
                killTribute(ctx, lead, target, { weapon: bestWeapon(target) });
                continue;
            }
        }

        // Focus fire is action economy, not just a power bonus: every
        // attacker beyond the lead presses the same target this round, each
        // at a flat penalty. Without this a six-strong pack dealt exactly one
        // blow per round — the same as a duel, only slightly harder — which
        // left the Career pack largely decorative.
        let targetDown = target.status !== 'alive';
        for (const a of attackers) {
            if (targetDown || a.id === lead.id || a.status !== 'alive') continue;
            const supportWeapon = bestWeapon(a);
            const supportEdge = combatPower(ctx, a, supportWeapon, 0, target)
                - combatPower(ctx, target, bestWeapon(target), 0, a)
                - COMBAT.supportAttackPenalty;
            if (supportEdge <= 0) continue;
            noteGroupFight(a, target);
            landHit(ctx, a, target, supportEdge, supportWeapon);
            if (target.health <= 0) {
                killTribute(ctx, target, a, { weapon: supportWeapon });
                targetDown = true;
            }
        }
        if (targetDown) continue;

        // Anyone can break off, and being outnumbered is a good reason to.
        // The opponent each combatant weighs is whoever leads the *other* side
        // — not `lead` for everyone, which had the lead computing fear of
        // themselves.
        const breaking = [...left, ...right].filter(t =>
            t.status === 'alive' && wantsToRetreat(
                ctx, t,
                defenders.includes(t) ? Math.max(1, advantage) : 0,
                rounds,
                attackers.includes(t) ? target : lead));
        if (breaking.length > 0) {
            breaking.forEach(t => { t.stance = 'Evasive'; t.stanceHeld = 0; });
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
                incurDebt(other, t, DEBTS.savedInFight);
            } else {
                noteStoodBy(t, other.id);
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
        const standing = fighters.filter(t => t.status === 'alive' && t.zone === zone && !withdrawn.has(t.id));
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
            t.id !== attacker.id && !areLovers(attacker, t) && !hasTruce(ctx.state, attacker, t.id));
        if (targets.length === 0) break;
        // The wounded are still likeliest to draw the blow — a hurt tribute is
        // the obvious opening — but "likeliest" is now a weight rather than a
        // certainty, and a sworn grudge outranks pure opportunism.
        const target = weightedPick(ctx, targets, t =>
            Math.max(1, 100 - t.health)
            + (hasVengeanceAgainst(attacker, t.id) ? COMBAT.freeForAllVengeanceWeight : 0));

        noteFight(ctx.state, attacker, target);
        const weapon = bestWeapon(attacker);
        const edge = combatPower(ctx, attacker, weapon, 0, target)
            - combatPower(ctx, target, bestWeapon(target), 0, attacker);
        if (edge > 0) {
            landHit(ctx, attacker, target, edge, weapon);
            if (target.health <= 0) { killTribute(ctx, target, attacker, { weapon }); continue; }
        } else {
            landHit(ctx, target, attacker, -edge, bestWeapon(target));
            if (attacker.health <= 0) { killTribute(ctx, attacker, target, { weapon: bestWeapon(target) }); continue; }
        }

        const breaking = standing.filter(t =>
            t.status === 'alive' && wantsToRetreat(ctx, t, 1, rounds, t.id === attacker.id ? target : attacker));
        if (breaking.length > 0) {
            breaking.forEach(t => {
                t.stance = 'Evasive';
                t.stanceHeld = 0;
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

export function killTribute(ctx: SimContext, victim: Tribute, killer?: Tribute, opts: { weapon?: Item; cause?: string } = {}) {
    const { weapon, cause } = opts;
    if (victim.status === 'dead') return;
    victim.status = 'dead';
    victim.health = 0;
    victim.dayOfDeath = ctx.state.day;

    // A corpse is not part of an alliance; leaving the id set kept dead
    // tributes in the alliance roster and skewed betrayal targeting.
    const formerAlliance = victim.allianceId;
    // Captured before the cleanup below: killing your last remaining ally
    // dissolves the alliance and strips the killer's id, which made the
    // ally-kill sanity toll unreachable for two-person alliances.
    const killerWasAllied = !!formerAlliance && killer?.allianceId === formerAlliance;
    delete victim.allianceId;
    if (formerAlliance) {
        const remaining = ctx.state.tributes.filter(t => t.status === 'alive' && t.allianceId === formerAlliance);
        if (remaining.length < 2) remaining.forEach(m => delete m.allianceId);
    }

    if (killer) {
        const killerAlive = killer.status === 'alive';
        if (killerAlive) killer.kills += 1;
        victim.causeOfDeath = cause
            || (weapon ? `Killed by ${killer.name} (${weapon.name})` : `Killed by ${killer.name}`);

        const weaponType = weapon ? weapon.id : 'unarmed';
        const templates = WEAPON_KILL_TEMPLATES[weaponType] || WEAPON_KILL_TEMPLATES['unarmed'];
        const template = ctx.pickText(templates);
        // split/join, not replace: `replace` with a string pattern only
        // substitutes the FIRST match, so templates naming {victim} twice
        // printed a raw placeholder into the feed.
        const text = template
            .split('{killer}').join(killer.name)
            .split('{victim}').join(victim.name);

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
            killer.vitals.sanity -= toll;
            if (toll >= COMBAT.killSanityBreakdown) {
                ctx.logEvent(
                    `${killer.name} stares at what they have done and cannot stop shaking. This is not who they were.`,
                    [killer.id],
                    { category: 'sanity' }
                );
            }
            // Killing someone you were allied with is its own kind of wound.
            if (killerWasAllied) {
                killer.vitals.sanity -= 12;
            }
            // Vengeance discharged.
            const mem = ensureMemory(killer);
            if (mem.vengeance.includes(victim.id)) {
                mem.vengeance = mem.vengeance.filter(id => id !== victim.id);
                killer.vitals.sanity += 20;
                addExcitement(killer, 30);
                ctx.logEvent(
                    `${killer.name} settles the debt. ${victim.name} is dead, and whatever was driving ${killer.name} goes quiet.`,
                    [killer.id, victim.id],
                    { important: true, category: 'kill' }
                );
            }

            // The arc: the first one changes you, and enough of them changes
            // how the rest of the arena talks about you.
            if (killer.kills === 1) earnTrait(ctx, killer, 'Bloodied');
            if (killer.kills >= HUNTING.fearedAtKills) earnTrait(ctx, killer, 'Feared');

            if (weapon && weapon.durability !== undefined) weapon.durability -= 10;

            clampTribute(killer);

            if (victim.inventory.length > 0) {
                const spoils = victim.inventory;
                victim.inventory = [];
                const dropped = giveItem(killer, ...spoils);
                const taken = spoils.filter(i => !dropped.includes(i));
                const lootNames = taken.map(i => i.name).join(', ');
                if (dropped.length > 0) {
                    ctx.logEvent(
                        `${text} ${killer.name} takes what they can carry — ${lootNames || 'nothing they can use'} — and leaves ${dropped.map(i => i.name).join(', ')} in the dirt.`,
                        [killer.id, victim.id],
                        { important: true, category: 'kill' }
                    );
                } else {
                    ctx.logEvent(`${text} ${killer.name} strips the body: ${lootNames}.`, [killer.id, victim.id], { important: true, category: 'kill' });
                }
            } else {
                ctx.logEvent(text, [killer.id, victim.id], { important: true, category: 'kill' });
            }
        } else {
            ctx.logEvent(text, [killer.id, victim.id], { important: true, category: 'kill' });
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
        ctx.logEvent(text, witness ? [victim.id, witness.id] : [victim.id], { important: true, category: 'death' });
    }

    // §6.9: the district token goes home with the body. The cameras do not
    // always find it, but when they do it is the shot of the night. Selection
    // is deterministic from the death itself rather than an rng draw — a
    // per-kill draw here would shift every roll downstream of every kill,
    // which perturbs the whole run for the sake of one flavour line.
    if (victim.token && (victim.district + ctx.state.day + victim.age) % 4 === 0) {
        ctx.logEvent(
            `The hovercraft lifts ${victim.name} with their district token still on them — ${victim.token}. District ${victim.district} sent it out with them, and District ${victim.district} gets it back.`,
            [victim.id],
            { category: 'death' }
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

    // Everything a cannon does to everyone still breathing.
    broadcastDeath(ctx, victim, killer);
    propagateDeathFallout(ctx, victim, killer);

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
