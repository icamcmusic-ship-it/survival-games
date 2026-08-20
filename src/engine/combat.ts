import { DamageRecord, Item, Tribute } from '../models/types';
import { SimContext } from './context';
import { WEAPON_KILL_TEMPLATES, DEATH_TEXTS, DUEL_TEXTS, GROUP_COMBAT_TEXTS } from '../data/flavorText';
import { ARCHETYPES } from '../data/archetypes';
import { COMBAT, MEMORY, STEALTH } from '../data/balance';
import { clampTribute } from './vitals';
import { giveItem } from './items';
import { rollAmbush } from './stealth';
import { getZone } from './map';
import { addZoneThreat, broadcastDeath, cycleOf, ensureMemory, hasVengeanceAgainst, noteContact } from './memory';
import { adjustRel, getRel, propagateDeathFallout } from './relationships';

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
    const killer = record?.sourceId
        ? ctx.state.tributes.find(o => o.id === record.sourceId && o.status === 'alive')
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

function combatPower(ctx: SimContext, t: Tribute, weapon?: Item, allies = 0): number {
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
        } else if (weapon.weaponClass === 'thrown') {
            // Throwing wants both the arm behind it and the eye in front of it.
            power += Math.floor(effectiveStrength(t) / COMBAT.thrownStrengthDivisor)
                + Math.floor(t.attributes.agility / COMBAT.thrownAgilityDivisor);
        }
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

    return power;
}

/** Per-round retreat check. Nobody has to fight to the death. */
function wantsToRetreat(ctx: SimContext, t: Tribute, opponentEdge: number, roundsFought: number): boolean {
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

    if (ctx.rng.chance(COMBAT.bleedChance)) defender.injuries.bleeding = true;
    if (ctx.rng.chance(COMBAT.woundChance)) {
        const site = ctx.rng.pick(['head', 'torso', 'arms', 'legs'] as const);
        defender.injuries[site] = true;
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
    adjustRel(defender, attacker.id, -COMBAT.grudgeOnWound);
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
export function resolveCombat(ctx: SimContext, t1: Tribute, t2: Tribute, isBloodbath: boolean = false) {
    if (t1.status === 'dead' || t2.status === 'dead') return;

    // Star-crossed lovers refuse to fight each other!
    if (t1.traits.includes('Star-Crossed') && t2.traits.includes('Star-Crossed') && t1.district === t2.district) {
        ctx.logEvent(`${t1.name} and ${t2.name} refuse to fight each other due to their deep bond as star-crossed lovers.`, [t1.id, t2.id], { category: 'romance' });
        return;
    }

    noteContact(ctx.state, t1, t2);

    // The first argument is whoever found the other. If they found them from
    // cover, the fight opens with a free hit rather than a fair exchange.
    const zone = getZone(ctx.state.arena, t1.zone);
    const ambushed = !isBloodbath && rollAmbush(ctx, t1, t2, zone);
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
        if (wantsToRetreat(ctx, t2, damage / 10, 1)) {
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

    const maxRounds = isBloodbath ? COMBAT.maxRounds + 1 : COMBAT.maxRounds;
    let round = 0;
    let ended = false;

    while (round < maxRounds && t1.status === 'alive' && t2.status === 'alive') {
        round++;
        const w1 = bestWeapon(t1);
        const w2 = bestWeapon(t2);
        const p1 = combatPower(ctx, t1, w1);
        const p2 = combatPower(ctx, t2, w2);
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
            landHit(ctx, winner, loser, Math.abs(edge), weapon);
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

        // Retreat check, every round, for both sides.
        const t1Flees = wantsToRetreat(ctx, t1, -edge, round);
        const t2Flees = wantsToRetreat(ctx, t2, edge, round);
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
    ctx.logEvent(
        fill(ctx.pickText(GROUP_COMBAT_TEXTS.open), { names: fighters.map(f => f.name).join(', '), zone }),
        fighters.map(f => f.id),
        { important: true, category: 'combat' }
    );

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

    const packSide: Tribute[] = [];
    const otherSide: Tribute[] = [];
    fighters.forEach(f => {
        if (anchorId && f.allianceId === anchorId) packSide.push(f);
        else otherSide.push(f);
    });
    if (packSide.length === 0) {
        // No pack: split by mutual regard, so friends do not knife each other.
        const seed = otherSide.shift()!;
        packSide.push(seed);
        [...otherSide].forEach(f => {
            if (getRel(f, seed.id) > 15 && getRel(seed, f.id) > 15) {
                packSide.push(f);
                otherSide.splice(otherSide.indexOf(f), 1);
            }
        });
    }
    if (otherSide.length === 0) return; // Everyone present is on the same side.

    let rounds = 0;
    while (rounds < COMBAT.maxGroupRounds) {
        rounds++;
        const left = packSide.filter(t => t.status === 'alive' && t.zone === zone);
        const right = otherSide.filter(t => t.status === 'alive' && t.zone === zone);
        if (left.length === 0 || right.length === 0) break;

        const attackers = ctx.rng.chance(left.length / (left.length + right.length)) ? left : right;
        const defenders = attackers === left ? right : left;
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
            t.status === 'alive' && wantsToRetreat(ctx, t, defenders.includes(t) ? Math.max(1, advantage) : 0, rounds));
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

    if (killer) {
        killer.kills += 1;
        killer.excitementRating += 20;
        victim.causeOfDeath = cause
            || (weapon ? `Killed by ${killer.name} (${weapon.name})` : `Killed by ${killer.name}`);

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

        const weaponType = weapon ? weapon.id : 'unarmed';
        const templates = WEAPON_KILL_TEMPLATES[weaponType] || WEAPON_KILL_TEMPLATES['unarmed'];
        const template = ctx.pickText(templates);
        // split/join, not replace: `replace` with a string pattern only
        // substitutes the FIRST match, so templates naming {victim} twice
        // printed a raw placeholder into the feed.
        const text = template
            .split('{killer}').join(killer.name)
            .split('{victim}').join(victim.name);

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
        victim.causeOfDeath = cause || victim.lastDamage?.cause || 'Died to environment';
        const template = ctx.rng.pick(DEATH_TEXTS.environmental);
        const text = template
            .split('{tribute}').join(victim.name)
            .split('{zone}').join(victim.zone)
            .split('{cause}').join(victim.causeOfDeath);
        ctx.logEvent(text, [victim.id], { important: true, category: 'death' });
    }

    // Everything a cannon does to everyone still breathing.
    broadcastDeath(ctx, victim, killer);
    propagateDeathFallout(ctx, victim, killer);
}
