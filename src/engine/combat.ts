import { Tribute, Item } from '../models/types';
import { SimContext } from './context';
import { WEAPON_KILL_TEMPLATES } from '../data/flavorText';
import { ARCHETYPES } from '../data/archetypes';

function bestWeapon(t: Tribute): Item | undefined {
    const weapons = t.inventory.filter(i => i.type === 'weapon');
    if (weapons.length === 0) return undefined;
    return weapons.reduce((best, w) => ((w.damage ?? 0) > (best.damage ?? 0) ? w : best));
}

function combatPower(ctx: SimContext, t: Tribute, weapon?: Item): number {
    let power = t.attributes.strength + t.attributes.agility + ctx.rng.nextInt(0, 5);

    if (weapon) {
        power += weapon.damage ?? weapon.value / 10;
        // Ranged weapons reward agility; melee rewards raw strength
        if (weapon.weaponClass === 'ranged') power += Math.floor(t.attributes.agility / 3);
        else if (weapon.weaponClass === 'melee') power += Math.floor(t.attributes.strength / 3);
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

    return power;
}

export function resolveCombat(ctx: SimContext, t1: Tribute, t2: Tribute, isBloodbath: boolean = false) {
    if (t1.status === 'dead' || t2.status === 'dead') return;

    // Star-crossed lovers refuse to fight each other!
    if (t1.traits.includes('Star-Crossed') && t2.traits.includes('Star-Crossed') && t1.district === t2.district) {
        ctx.logEvent(`${t1.name} and ${t2.name} refuse to fight each other due to their deep bond as star-crossed lovers.`, [t1.id, t2.id]);
        return;
    }

    const t1Weapon = bestWeapon(t1);
    const t2Weapon = bestWeapon(t2);

    const t1Power = combatPower(ctx, t1, t1Weapon);
    const t2Power = combatPower(ctx, t2, t2Weapon);

    if (t1Power > t2Power + 3) {
        killTribute(ctx, t2, t1, isBloodbath, t1Weapon);
    } else if (t2Power > t1Power + 3) {
        killTribute(ctx, t1, t2, isBloodbath, t2Weapon);
    } else {
        t1.health -= 20;
        t2.health -= 20;
        t1.injuries.bleeding = true;
        t2.injuries.bleeding = true;

        // Poisoned weapons leave their mark even in a draw
        if (t1Weapon?.poison && ctx.rng.chance(0.5)) {
            t2.injuries.poisoned = true;
            ctx.logEvent(`${t2.name} is grazed by ${t1.name}'s poisoned dart and feels the venom spreading.`, [t2.id, t1.id], true);
        }
        if (t2Weapon?.poison && ctx.rng.chance(0.5)) {
            t1.injuries.poisoned = true;
            ctx.logEvent(`${t1.name} is grazed by ${t2.name}'s poisoned dart and feels the venom spreading.`, [t1.id, t2.id], true);
        }

        // Random localized injury
        if (ctx.rng.chance(0.3)) t1.injuries.arms = true;
        if (ctx.rng.chance(0.3)) t2.injuries.legs = true;

        ctx.logEvent(`${t1.name} and ${t2.name} fight but both escape injured.`, [t1.id, t2.id]);

        // Weapon durability loss
        if (t1Weapon && t1Weapon.durability) t1Weapon.durability -= 10;
        if (t2Weapon && t2Weapon.durability) t2Weapon.durability -= 10;

        // Grudge formed
        t1.relationships[t2.id] = (t1.relationships[t2.id] || 0) - 20;
        t2.relationships[t1.id] = (t2.relationships[t1.id] || 0) - 20;

        checkDeath(ctx, t1, `Bled out after a brutal fight with ${t2.name}`);
        checkDeath(ctx, t2, `Bled out after a brutal fight with ${t1.name}`);
    }

    // Clean up broken weapons
    [t1, t2].forEach(t => {
        t.inventory = t.inventory.filter(i => i.type !== 'weapon' || (i.durability === undefined || i.durability > 0));
    });
}

export function killTribute(ctx: SimContext, victim: Tribute, killer?: Tribute, isBloodbath: boolean = false, weapon?: Item, cause?: string) {
    victim.status = 'dead';
    victim.health = 0;
    victim.dayOfDeath = ctx.state.day;

    // Star-crossed lover heartbreak logic
    if (victim.traits.includes('Star-Crossed')) {
        const partner = ctx.state.tributes.find(t => t.district === victim.district && t.id !== victim.id && t.status === 'alive');
        if (partner && partner.traits.includes('Star-Crossed')) {
            partner.vitals.sanity = Math.max(0, partner.vitals.sanity - 60);
            partner.excitementRating += 55;
            ctx.logEvent(`TRAGEDY: ${partner.name} screams in agony as their star-crossed lover ${victim.name} is eliminated, suffering a devastating blow to their sanity.`, [partner.id, victim.id], true);
        }
    }

    if (killer) {
        killer.kills += 1;
        killer.excitementRating += 20;
        victim.causeOfDeath = weapon ? `Killed by ${killer.name} (${weapon.name})` : `Killed by ${killer.name}`;

        // Trauma Triggers
        if (killer.traits.includes('Pacifist')) {
            killer.vitals.sanity -= 40;
            ctx.logEvent(`${killer.name} is deeply traumatized by the act of killing.`, [killer.id]);
        } else if (!killer.isCareer) {
            killer.vitals.sanity -= 10;
        }

        const weaponType = weapon ? weapon.id : 'unarmed';
        const templates = WEAPON_KILL_TEMPLATES[weaponType] || WEAPON_KILL_TEMPLATES['unarmed'];
        const template = ctx.rng.pick(templates);
        const text = template.replace('{killer}', killer.name).replace('{victim}', victim.name);

        if (weapon && weapon.durability) weapon.durability -= 10;

        if (victim.inventory.length > 0) {
            const lootNames = victim.inventory.map(i => i.name).join(', ');
            killer.inventory.push(...victim.inventory);
            victim.inventory = [];
            ctx.logEvent(`${text} ${killer.name} loots: ${lootNames}.`, [killer.id, victim.id], true);
        } else {
            ctx.logEvent(text, [killer.id, victim.id], true);
        }
    } else {
        victim.causeOfDeath = cause || 'Died to environment';
        ctx.logEvent(`${victim.name} dies. (${victim.causeOfDeath})`, [victim.id], true);
    }
}

export function checkDeath(ctx: SimContext, t: Tribute, cause?: string) {
    if (t.health <= 0 && t.status === 'alive') {
        killTribute(ctx, t, undefined, false, undefined, cause);
    }
}
