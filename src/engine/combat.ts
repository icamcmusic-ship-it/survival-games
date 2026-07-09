import { Tribute, Item } from '../models/types';
import { SimContext } from './context';
import { WEAPON_KILL_TEMPLATES } from '../data/flavorText';
import { getArchetypeModifiers } from '../data/archetypes';

export function resolveCombat(ctx: SimContext, t1: Tribute, t2: Tribute, isBloodbath: boolean = false) {
    if (t1.status === 'dead' || t2.status === 'dead') return;

    // Star-crossed lovers refuse to fight each other!
    if (t1.traits.includes('Star-Crossed') && t2.traits.includes('Star-Crossed') && t1.district === t2.district) {
        ctx.logEvent(`${t1.name} and ${t2.name} refuse to fight each other due to their deep bond as star-crossed lovers.`, [t1.id, t2.id]);
        return;
    }

    const t1Weapon = t1.inventory.find(i => i.type === 'weapon');
    const t2Weapon = t2.inventory.find(i => i.type === 'weapon');

    // Ranged/thrown weapons reward agility (accuracy); melee rewards raw strength.
    const weaponPower = (t: Tribute, weapon?: Item) => {
        if (!weapon) return 0;
        const base = weapon.value / 10;
        if (weapon.subtype === 'ranged') return base + t.attributes.agility * 0.3;
        if (weapon.subtype === 'thrown') return base + t.attributes.agility * 0.15;
        return base;
    };

    let t1Power = t1.attributes.strength + t1.attributes.agility + weaponPower(t1, t1Weapon) + ctx.rng.nextInt(0, 5) + getArchetypeModifiers(t1).combatPower;
    let t2Power = t2.attributes.strength + t2.attributes.agility + weaponPower(t2, t2Weapon) + ctx.rng.nextInt(0, 5) + getArchetypeModifiers(t2).combatPower;

    // Injury penalties
    if (t1.injuries.arms) t1Power -= 2;
    if (t1.injuries.legs) t1Power -= 2;
    if (t1.injuries.concussed) t1Power -= 2;
    if (t1.injuries.exhausted) t1Power -= 2;
    if (t2.injuries.arms) t2Power -= 2;
    if (t2.injuries.legs) t2Power -= 2;
    if (t2.injuries.concussed) t2Power -= 2;
    if (t2.injuries.exhausted) t2Power -= 2;

    if (t1Power > t2Power + 3) {
        killTribute(ctx, t2, t1, isBloodbath, t1Weapon);
    } else if (t2Power > t1Power + 3) {
        killTribute(ctx, t1, t2, isBloodbath, t2Weapon);
    } else {
        t1.health -= 20;
        t2.health -= 20;
        t1.injuries.bleeding = true;
        t2.injuries.bleeding = true;

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

        checkDeath(ctx, t1);
        checkDeath(ctx, t2);
    }

    // Clean up broken weapons
    [t1, t2].forEach(t => {
        t.inventory = t.inventory.filter(i => i.type !== 'weapon' || (i.durability === undefined || i.durability > 0));
    });
}

export function killTribute(ctx: SimContext, victim: Tribute, killer?: Tribute, isBloodbath: boolean = false, weapon?: Item) {
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
        victim.causeOfDeath = `Killed by ${killer.name}`;

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
        victim.causeOfDeath = 'Died to environment';
        ctx.logEvent(`${victim.name} dies.`, [victim.id], true);
    }
}

export function checkDeath(ctx: SimContext, t: Tribute) {
    if (t.health <= 0 && t.status === 'alive') {
        killTribute(ctx, t);
    }
}
