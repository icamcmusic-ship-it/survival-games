import { SimContext, getAlive } from '../context';
import { RNG } from '../../utils/rng';
import { Tribute } from '../../models/types';
import { ITEMS } from '../../data/constants';
import { ARCHETYPES } from '../../data/archetypes';
import { resolveCombat } from '../combat';

export function startGames(ctx: SimContext) {
    ctx.state.phase = 'bloodbath';
    ctx.state.day = 1;
    initializeCareerAlliance(ctx);
}

function initializeCareerAlliance(ctx: SimContext) {
    const careers = getAlive(ctx.state).filter(t => t.isCareer);
    if (careers.length > 1) {
        const allianceId = `career-pack-${ctx.state.seed}`;
        careers.forEach(t => {
            t.allianceId = allianceId;
            // Set initial positive relationships within the pack
            careers.forEach(other => {
                if (t.id !== other.id) {
                    t.relationships[other.id] = 50;
                }
            });
        });
        ctx.logEvent("The Careers from Districts 1, 2, and 4 have formed a lethal pack.", careers.map(c => c.id), true);
    }
}

export function processBloodbath(ctx: SimContext) {
    ctx.state.phase = 'bloodbath';
    ctx.rng = new RNG(`${ctx.state.seed}-bloodbath`);
    const alive = getAlive(ctx.state);

    const shuffled = [...alive].sort(() => ctx.rng.nextFloat() - 0.5);

    const runners: Tribute[] = [];
    const fighters: Tribute[] = [];

    shuffled.forEach(t => {
        let fightChance = 0.3;
        if (t.isCareer) fightChance += 0.4;
        if (t.attributes.strength > 7) fightChance += 0.2;
        if (t.traits.includes('Bloodthirsty')) fightChance += 0.3;
        if (t.traits.includes('Pacifist')) fightChance -= 0.3;
        fightChance += ARCHETYPES[t.archetype].aggression - ARCHETYPES[t.archetype].caution * 0.5;

        if (ctx.rng.chance(fightChance)) {
            fighters.push(t);
        } else {
            runners.push(t);
        }
    });

    runners.forEach(t => {
        if (ctx.rng.chance(0.8)) {
            ctx.logEvent(`${t.name} runs away from the Cornucopia.`, [t.id]);
        } else {
            const item = ctx.rng.pick(ITEMS);
            t.inventory.push({ ...item });
            ctx.logEvent(`${t.name} grabs a ${item.name} and runs away.`, [t.id]);
        }
    });

    while (fighters.length > 1) {
        const t1 = fighters.splice(ctx.rng.nextInt(0, fighters.length - 1), 1)[0];
        const t2 = fighters.splice(ctx.rng.nextInt(0, fighters.length - 1), 1)[0];

        if (t1 && t2) {
            resolveCombat(ctx, t1, t2, true);
            if (t1.status === 'alive') fighters.push(t1);
            if (t2.status === 'alive') fighters.push(t2);
        } else {
            if (t1 && t1.status === 'alive') fighters.push(t1);
            if (t2 && t2.status === 'alive') fighters.push(t2);
        }
    }

    if (fighters.length === 1) {
        const winner = fighters[0];
        const item1 = ctx.rng.pick(ITEMS);
        const item2 = ctx.rng.pick(ITEMS);
        winner.inventory.push({ ...item1 }, { ...item2 });
        ctx.logEvent(`${winner.name} survives the bloodbath and claims ${item1.name} and ${item2.name}.`, [winner.id]);
    }

    ctx.state.phase = 'day';
}
