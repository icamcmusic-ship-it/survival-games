import { SimContext, getAlive } from './context';
import { checkDeath } from './combat';
import { getZone } from './map';

const WEATHER_EFFECTS = [
    { name: 'a torrential downpour', fatigue: 15, sanity: 5, quench: true },
    { name: 'a scorching heatwave', fatigue: 20, sanity: 10, thirst: 20 },
    { name: 'a freezing cold snap', fatigue: 25, sanity: 10, frostbite: true },
    { name: 'a choking toxic fog', fatigue: 10, sanity: 20, poison: true },
];

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
                checkDeath(ctx, t, `Torn apart by Gamemaker-released ${mutt}`);
            }
        } else {
            ctx.logEvent(`GAMEMAKER: ${mutt} are released into the arena!`, [], true);
            getAlive(ctx.state).forEach(t => {
                // Tributes in dangerous zones are easier prey for released mutts
                const zone = getZone(ctx.state.arena, t.zone);
                const hitChance = 0.2 + (zone ? zone.danger * 0.3 : 0.1);
                if (ctx.rng.chance(hitChance)) {
                    t.health -= 20 + ctx.rng.nextInt(0, 15);
                    if (ctx.rng.chance(0.3)) t.injuries.bleeding = true;
                    ctx.logEvent(`${t.name} is mauled by the ${mutt} prowling through ${t.zone}.`, [t.id], true);
                    checkDeath(ctx, t, `Torn apart by ${mutt} in ${t.zone}`);
                }
            });
        }
    } else if (type === 'weather') {
        const weather = ctx.rng.pick(WEATHER_EFFECTS);
        ctx.logEvent(`GAMEMAKER: The weather shifts drastically. ${weather.name.charAt(0).toUpperCase() + weather.name.slice(1)} sweeps the arena!`, [], true);
        getAlive(ctx.state).forEach(t => {
            t.vitals.fatigue += weather.fatigue;
            t.vitals.sanity -= weather.sanity;
            if (weather.thirst) t.vitals.thirst += weather.thirst;
            if (weather.quench) t.vitals.thirst = Math.max(0, t.vitals.thirst - 30);
            if (weather.frostbite && ctx.rng.chance(0.15) && !t.injuries.frostbitten) {
                t.injuries.frostbitten = true;
                ctx.logEvent(`${t.name} is caught in the open and suffers frostbite.`, [t.id], true);
            }
            if (weather.poison && ctx.rng.chance(0.15) && !t.injuries.poisoned) {
                t.injuries.poisoned = true;
                ctx.logEvent(`${t.name} inhales the toxic fog and is poisoned.`, [t.id], true);
            }
            checkDeath(ctx, t, `Perished in ${weather.name}`);
        });
    } else if (type === 'feast') {
        if (!ctx.state.config.enableFeast) return;
        ctx.logEvent(`GAMEMAKER: A feast is announced at the Cornucopia!`, [], true);
        ctx.state.phase = 'feast';
    }
}
