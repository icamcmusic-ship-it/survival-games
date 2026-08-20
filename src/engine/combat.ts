import { DamageRecord, Item, Tribute } from '../models/types';
import { SimContext } from './context';
import { WEAPON_KILL_TEMPLATES, DEATH_TEXTS, DUEL_TEXTS, GROUP_COMBAT_TEXTS } from '../data/flavorText';
import { ARCHETYPES } from '../data/archetypes';
import { BLEEDING, COMBAT, FEAR, HUNTING, MEMORY, PROFICIENCY, RIVALRY, STEALTH } from '../data/balance';
import { clampTribute } from './vitals';
import { giveItem } from './items';
import { rollAmbush } from './stealth';
import { getZone } from './map';
import { addZoneThreat, broadcastDeath, cycleOf, ensureMemory, hasVengeanceAgainst, noteContact, noteFight, noteFled, noteStoodBy, noteWound, rivalRecord } from './memory';
import { adjustRel, getRel, propagateDeathFallout } from './relationships';
import { openWound } from './wounds';
import { profOf, trainProficiency, weaponAffinity, weaponProficiency } from './proficiency';
import { addFear, fearFraction } from './fear';
import { areLovers } from './alliance';
import { reachBonus } from './physique';

const fill = (template: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((text, [k, v]) => text.split(`{${k}}`).join(v), template);

function bestWeapon(t: Tribute): Item | undefined {
    const weapons = t.inventory.filter(i => i.type === 'weapon');
    if (weapons.length === 0) return undefined;
    return weapons.reduce((best, w) => ((w.damage ?? 0) > (best.damage ?? 0) ? w : best));
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
export function applyDamage(
    ctx: SimContext,
    t: Tribute,
    amount: number,
    record: Omit<DamageRecord, 'cycle' | 'amount'>,
) {
    if (amount <= 0) return;
    t.health -= amount;
    t.lastDamage = { ...record, cycle: cycleOf(ctx.state), amount };
    clampTribute(t);
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
        killTribute(ctx, t, killer, false, undefined, record?.cause);
    } else {
        killTribute(ctx, t, undefined, false, undefined, record?.cause || fallbackCause);
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
        power += weapon.damage ?? weapon.value / 10;
        // Ranged weapons reward agility; melee rewards raw strength
        // Every weapon class scales with something. 'thrown' had no branch at
        // all, so Throwing Knives and the Spear — the one weapon a tribute can
        // craft mid-run — were the only weapons in the game with no stat
        // scaling behind them, which made crafting a downgrade.
        if (weapon.weaponClass === 'ranged') {
            power += Math.floor(t.attributes.agility / COMBAT.rangedAgilityDivisor);
        } else if (weapon.weaponClass === 'melee') {
            power += Math.floor(effectiveStrength(t) / COMBAT.meleeStrengthDivisor);
            // Reach: a long-armed tribute lands first in a melee. `heightCm` was
            // generated with care and then read only by display code.
            power += reachBonus(t);
        } else if (weapon.weaponClass === 'thrown') {
            // Throwing wants both the arm behind it and the eye in front of it.
            power += Math.floor(effectiveStrength(t) / COMBAT.thrownStrengthDivisor)
                + Math.floor(t.attributes.agility / COMBAT.thrownAgilityDivisor);
        }
        // Practice with the class of weapon actually in their hands.
        power += profOf(t, weaponProficiency(weapon.weaponClass)) * PROFICIENCY.combatWeight;
        // And familiarity with this *particular* weapon, from home rather than
        // from the training centre. A trident is a fishing tool to District 4
        // and an awkward three-pronged spear to everybody else.
        power += weaponAffinity(t, weapon);
    } else {
        // Bare hands are a grapple, and a grapple is decided by mass and reach.
        power += reachBonus(t);
    }

    // Archetype edge: aggressive fighters commit harder
    power += ARCHETYPES[t.archetype].aggression * 4;

    // Injury and status penalties
    if (t.injuries.arms) power -= 2;
    if (t.injuries.legs) power -= 2;
    if (t.injuries.poisoned) power -= 3;
    if (t.injuries.burned) power -= 1;
    if (t.injuries.frostbitten) power -= 2;
    if (t.vitals.fatigue > 80) power -= 2;
    // A wrecked tribute fights like one.
    power -= (100 - t.health) / 22;

    // Numbers advantage: the whole point of a pack.
    power += Math.min(COMBAT.outnumberMaxBonus, allies * COMBAT.outnumberPowerPerAlly);

    // Bloodlust. A tribute who has just killed is keyed up and dangerous — this
    // is what lets a hunter snowball instead of every fight starting from zero.
    power += (t.momentum ?? 0) * HUNTING.momentumPowerWeight;

    // What they have learned from losing to this person before.
    power += rematchEdge(t, opponent);

    return power;
}

/** Per-round retreat check. Nobody has to fight to the death. */
function wantsToRetreat(ctx: SimContext, t: Tribute, opponentEdge: number, roundsFought: number, opponent?: Tribute): boolean {
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
    if (t.traits.includes('Pacifist')) chance += 0.25;
    if (t.traits.includes('Bloodthirsty')) chance -= 0.25;
    if (t.isCareer) chance -= 0.1;
    if (t.stance === 'Aggressive') chance -= 0.12;
    if (t.stance === 'Evasive') chance += 0.15;
    // Who they are fighting, not just how badly it is going: a tribute who has
    // watched this particular person kill wants out long before the numbers say so.
    if (opponent) chance += fearFraction(t, opponent.id) * FEAR.retreatWeight;
    // Bloodlust cuts the other way — a fresh kill is hard to walk away from.
    chance -= (t.momentum ?? 0) * HUNTING.momentumRetreatWeight;
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
        defender.injuries[site] = true;
    }
    // A Pyromaniac fights dirty with whatever burns — every landed hit has a
    // real chance to leave the defender scorched, not just bruised.
    if (attacker.traits.includes('Pyromaniac') && !defender.injuries.burned && ctx.rng.chance(COMBAT.pyromaniacBurnChance)) {
        defender.injuries.burned = true;
        ctx.logEvent(
            `${attacker.name}'s strike leaves ${defender.name} scorched — Pyromaniacs make sure something is always burning.`,
            [defender.id, attacker.id],
            { category: 'injury' }
        );
    }
    if (weapon?.poison && ctx.rng.chance(COMBAT.poisonTransferChance) && !defender.injuries.poisoned) {
        defender.injuries.poisoned = true;
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
            killTribute(ctx, t2, t1, isBloodbath, opener);
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
            adjustRel(t2, t1.id, -COMBAT.grudgePerFight);
            addZoneThreat(ctx.state, t2, t2.zone, MEMORY.fightThreat);
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
            ctx.logEvent(
                fill(ctx.pickText(DUEL_TEXTS.exchange), { winner: winner.name, loser: loser.name, zone: winner.zone }),
                [winner.id, loser.id],
                { category: 'combat' }
            );
            if (loser.health <= 0) {
                killTribute(ctx, loser, winner, isBloodbath, weapon);
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
                    killTribute(ctx, fleer, stayer, isBloodbath, parting);
                    ended = true;
                    break;
                }
            }
            ctx.logEvent(
                fill(ctx.pickText(DUEL_TEXTS.retreat), { fleer: fleer.name, stayer: stayer.name, zone: stayer.zone }),
                [fleer.id, stayer.id],
                { important: true, category: 'combat' }
            );
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
    // outright, so a bonded pair can never be assigned to opposite sides.
    const isBonded = (a: Tribute, b: Tribute) =>
        areLovers(a, b);
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
        const weapon = bestWeapon(lead);
        const edge = combatPower(ctx, lead, weapon, Math.max(0, advantage))
            - combatPower(ctx, target, bestWeapon(target), Math.max(0, -advantage));

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
                killTribute(ctx, target, lead, false, weapon);
                continue;
            }
        } else {
            // The outnumbered side lands one anyway — desperation cuts.
            landHit(ctx, target, lead, -edge, bestWeapon(target));
            if (lead.health <= 0) {
                killTribute(ctx, lead, target, false, bestWeapon(target));
                continue;
            }
        }

        // Anyone can break off, and being outnumbered is a good reason to.
        const breaking = [...left, ...right].filter(t =>
            t.status === 'alive' && wantsToRetreat(ctx, t, defenders.includes(t) ? Math.max(1, advantage) : 0, rounds, lead));
        if (breaking.length > 0) {
            breaking.forEach(t => { t.stance = 'Evasive'; t.stanceHeld = 0; });
            ctx.logEvent(
                fill(ctx.pickText(GROUP_COMBAT_TEXTS.scatter), { names: breaking.map(t => t.name).join(', '), zone }),
                breaking.map(t => t.id),
                { important: true, category: 'combat' }
            );
            break;
        }
    }

    fighters.forEach(t => {
        if (t.status !== 'alive') return;
        addZoneThreat(ctx.state, t, zone, MEMORY.fightThreat);
        dropBrokenWeapons(t);
        // Everyone who swung at you is now someone you would rather not meet.
        fighters.forEach(other => {
            if (other.id === t.id) return;
            const sameSide = (packSide.includes(t) && packSide.includes(other)) || (otherSide.includes(t) && otherSide.includes(other));
            if (!sameSide) adjustRel(t, other.id, -COMBAT.grudgePerFight);
            // Standing in the same line as somebody is the clearest way to earn
            // their trust, and it is what romance is actually gated on.
            else noteStoodBy(t, other.id);
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

    let rounds = 0;
    while (rounds < COMBAT.maxGroupRounds) {
        rounds++;
        const standing = fighters.filter(t => t.status === 'alive' && t.zone === zone);
        if (standing.length < 2) break;

        // Each round, one pairing resolves — weighted toward whoever is most
        // dangerous picking whoever is most vulnerable, which is how a
        // free-for-all actually collapses.
        const attacker = standing.reduce((best, t) =>
            combatPower(ctx, t, bestWeapon(t)) > combatPower(ctx, best, bestWeapon(best)) ? t : best);
        const targets = standing.filter(t => t.id !== attacker.id && !areLovers(attacker, t));
        if (targets.length === 0) break;
        const target = targets.reduce((weak, t) => (t.health < weak.health ? t : weak));

        noteFight(ctx.state, attacker, target);
        const weapon = bestWeapon(attacker);
        const edge = combatPower(ctx, attacker, weapon, 0, target)
            - combatPower(ctx, target, bestWeapon(target), 0, attacker);
        if (edge > 0) {
            landHit(ctx, attacker, target, edge, weapon);
            if (target.health <= 0) { killTribute(ctx, target, attacker, false, weapon); continue; }
        } else {
            landHit(ctx, target, attacker, -edge, bestWeapon(target));
            if (attacker.health <= 0) { killTribute(ctx, attacker, target, false, bestWeapon(target)); continue; }
        }

        const breaking = standing.filter(t =>
            t.status === 'alive' && wantsToRetreat(ctx, t, 1, rounds, t.id === attacker.id ? target : attacker));
        if (breaking.length > 0) {
            breaking.forEach(t => {
                t.stance = 'Evasive';
                t.stanceHeld = 0;
                noteFled(t, t.id === attacker.id ? target.id : attacker.id);
            });
            ctx.logEvent(
                fill(ctx.pickText(GROUP_COMBAT_TEXTS.scatter), { names: breaking.map(t => t.name).join(', '), zone }),
                breaking.map(t => t.id),
                { important: true, category: 'combat' }
            );
            break;
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

export function killTribute(ctx: SimContext, victim: Tribute, killer?: Tribute, _isBloodbath: boolean = false, weapon?: Item, cause?: string) {
    if (victim.status === 'dead') return;
    victim.status = 'dead';
    victim.health = 0;
    victim.dayOfDeath = ctx.state.day;

    // A corpse is not part of an alliance; leaving the id set kept dead
    // tributes in the alliance roster and skewed betrayal targeting.
    const formerAlliance = victim.allianceId;
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
            killer.excitementRating += 20;
            // Bloodlust: briefly stronger and far less willing to break off.
            killer.momentum = Math.min(HUNTING.momentumMax, (killer.momentum ?? 0) + HUNTING.momentumPerKill);

            // Trauma Triggers
            if (killer.traits.includes('Pacifist')) {
                killer.vitals.sanity -= 40;
                ctx.logEvent(`${killer.name} stares at what they have done and cannot stop shaking. This is not who they were.`, [killer.id], { category: 'sanity' });
            } else if (!killer.isCareer) {
                killer.vitals.sanity -= 10;
            }
            // Killing someone you were allied with is its own kind of wound.
            if (formerAlliance && formerAlliance === killer.allianceId) {
                killer.vitals.sanity -= 12;
            }
            // Vengeance discharged.
            const mem = ensureMemory(killer);
            if (mem.vengeance.includes(victim.id)) {
                mem.vengeance = mem.vengeance.filter(id => id !== victim.id);
                killer.vitals.sanity += 20;
                killer.excitementRating += 30;
                ctx.logEvent(
                    `${killer.name} settles the debt. ${victim.name} is dead, and whatever was driving ${killer.name} goes quiet.`,
                    [killer.id, victim.id],
                    { important: true, category: 'kill' }
                );
            }

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
        const template = ctx.rng.pick(DEATH_TEXTS.environmental);
        const text = template
            .split('{tribute}').join(victim.name)
            .split('{zone}').join(victim.zone)
            .split('{cause}').join(victim.causeOfDeath);
        ctx.logEvent(text, [victim.id], { important: true, category: 'death' });
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
}
