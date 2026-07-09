import { SimContext, getAlive } from '../context';
import { RNG } from '../../utils/rng';
import { ITEMS } from '../../data/constants';
import { resolveCombat } from '../combat';

export function processFeast(ctx: SimContext) {
    ctx.rng = new RNG(`${ctx.state.seed}-${ctx.state.day}-feast`);
    const alive = getAlive(ctx.state);
    const attendees = [] as typeof alive;

    alive.forEach(t => {
        if (ctx.rng.chance(0.6) || t.vitals.hunger > 70 || t.vitals.thirst > 70) {
            attendees.push(t);
        } else {
            ctx.logEvent(`${t.name} decides not to go to the feast.`, [t.id]);
        }
    });

    if (attendees.length === 0) {
        ctx.logEvent(`No one attends the feast.`, []);
        return;
    }

    const shuffled = [...attendees].sort(() => ctx.rng.nextFloat() - 0.5);

    while (shuffled.length > 1) {
        const t1 = shuffled.splice(ctx.rng.nextInt(0, shuffled.length - 1), 1)[0];
        const t2 = shuffled.splice(ctx.rng.nextInt(0, shuffled.length - 1), 1)[0];

        if (t1 && t2) {
            resolveCombat(ctx, t1, t2);
            if (t1.status === 'alive') shuffled.push(t1);
            if (t2.status === 'alive') shuffled.push(t2);
        } else {
            if (t1 && t1.status === 'alive') shuffled.push(t1);
            if (t2 && t2.status === 'alive') shuffled.push(t2);
        }
    }

    if (shuffled.length === 1) {
        const winner = shuffled[0];
        const item1 = ctx.rng.pick(ITEMS);
        const item2 = ctx.rng.pick(ITEMS);
        winner.inventory.push(item1, item2);
        winner.health = Math.min(100, winner.health + 50);
        winner.vitals.hunger = 0;
        winner.vitals.thirst = 0;
        ctx.logEvent(`${winner.name} survives the feast and claims ${item1.name} and ${item2.name}, fully restoring their vitals.`, [winner.id], true);
    }
}
