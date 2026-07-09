import { SimContext, getAlive } from './context';
import { checkDeath } from './combat';

export function triggerGamemakerEvent(ctx: SimContext, type: 'mutt' | 'weather' | 'feast', targetId?: string) {
    if (!ctx.state.gamemakerMode) return;

    if (type === 'mutt') {
        const mutt = ctx.rng.pick(ctx.state.arena.mutts);
        if (targetId) {
            const t = ctx.state.tributes.find(tr => tr.id === targetId);
            if (t && t.status === 'alive') {
                t.health -= 50;
                t.injuries.bleeding = true;
                ctx.logEvent(`GAMEMAKER: A pack of ${mutt} is unleashed directly on ${t.name}!`, [t.id], true);
                checkDeath(ctx, t);
            }
        } else {
            ctx.logEvent(`GAMEMAKER: ${mutt} are released into the arena!`, [], true);
            getAlive(ctx.state).forEach(t => {
                if (ctx.rng.chance(0.3)) {
                    t.health -= 20;
                    checkDeath(ctx, t);
                }
            });
        }
    } else if (type === 'weather') {
        const event = ctx.rng.pick(ctx.state.arena.events);
        ctx.logEvent(`GAMEMAKER: The weather shifts drastically. ${event} begins!`, [], true);
        getAlive(ctx.state).forEach(t => {
            t.vitals.fatigue += 20;
            t.vitals.sanity -= 10;
        });
    } else if (type === 'feast') {
        if (!ctx.state.config.enableFeast) return;
        ctx.logEvent(`GAMEMAKER: A feast is announced at the Cornucopia!`, [], true);
        ctx.state.phase = 'feast';
    }
}
