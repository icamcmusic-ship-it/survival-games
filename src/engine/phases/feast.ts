import { SimContext, getAlive } from '../context';
import { RNG } from '../../utils/rng';
import { ITEMS } from '../../data/constants';
import { resolveCombat } from '../combat';
import { FEAST_TEXTS } from '../../data/flavorText';
import { clampTribute } from '../vitals';
import { itemPhrase } from '../items';

const fill = (template: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((text, [k, v]) => text.split(`{${k}}`).join(v), template);

export function processFeast(ctx: SimContext) {
    ctx.rng = new RNG(`${ctx.state.seed}-${ctx.state.day}-feast`);
    const alive = getAlive(ctx.state);
    const attendees = [] as typeof alive;
    const cornucopia = ctx.state.arena.zones[0]?.name ?? 'The Cornucopia';

    ctx.state.feastsHeld = (ctx.state.feastsHeld ?? 0) + 1;

    const decliners = [] as typeof alive;
    alive.forEach(t => {
        if (ctx.rng.chance(0.6) || t.vitals.hunger > 70 || t.vitals.thirst > 70) {
            attendees.push(t);
        } else {
            decliners.push(t);
        }
    });

    // One line per tribute turned the feed into a wall of near-identical
    // sentences; past a couple of names these are summarised instead.
    const announce = (group: typeof alive, pool: string[], summary: (names: string) => string) => {
        if (group.length === 0) return;
        if (group.length <= 2) {
            group.forEach(t => ctx.logEvent(
                fill(ctx.pickText(pool), { tribute: t.name }),
                [t.id],
                { zone: cornucopia, category: 'feast' }
            ));
        } else {
            ctx.logEvent(summary(group.map(t => t.name).join(', ')), group.map(t => t.id), { zone: cornucopia, category: 'feast' });
        }
    };

    announce(decliners, FEAST_TEXTS.decline, names => `${names} weigh the feast against the odds and stay exactly where they are.`);
    attendees.forEach(t => { t.zone = cornucopia; });
    announce(attendees, FEAST_TEXTS.attend, names => `${names} break cover and converge on the Cornucopia.`);

    if (attendees.length === 0) {
        ctx.logEvent('Not one tribute comes to the feast. The table sits untouched until the Gamemakers withdraw it.', [], { important: true, category: 'feast' });
        return;
    }

    const shuffled = ctx.rng.shuffle(attendees);

    // Bounded, for the same reason as the bloodbath: an unkillable pairing
    // (mutual draws, or star-crossed lovers) must not spin forever.
    let rounds = shuffled.length * 6 + 12;
    while (shuffled.length > 1 && rounds-- > 0) {
        const t1 = shuffled.splice(ctx.rng.nextInt(0, shuffled.length - 1), 1)[0];
        const t2 = shuffled.splice(ctx.rng.nextInt(0, shuffled.length - 1), 1)[0];

        resolveCombat(ctx, t1, t2);
        // A draw usually means they break off rather than immediately
        // re-engaging the same opponent.
        if (t1.status === 'alive' && ctx.rng.chance(0.55)) shuffled.push(t1);
        if (t2.status === 'alive' && ctx.rng.chance(0.55)) shuffled.push(t2);
    }

    if (shuffled.length > 1) {
        ctx.logEvent(
            `${shuffled.map(t => t.name).join(' and ')} take what they can carry and back away from the Cornucopia without settling it.`,
            shuffled.map(t => t.id),
            { important: true, zone: cornucopia, category: 'feast' }
        );
        shuffled.splice(1).forEach(t => {
            const item = ctx.rng.pick(ITEMS);
            t.inventory.push({ ...item });
            t.vitals.hunger = Math.max(0, t.vitals.hunger - 40);
            t.vitals.thirst = Math.max(0, t.vitals.thirst - 40);
            clampTribute(t);
            ctx.logEvent(`${t.name} leaves the feast with ${itemPhrase(item)} and a full stomach.`, [t.id], { zone: cornucopia, category: 'feast' });
        });
    }

    if (shuffled.length === 1) {
        const winner = shuffled[0];
        const item1 = ctx.rng.pick(ITEMS);
        const item2 = ctx.rng.pick(ITEMS);
        winner.inventory.push({ ...item1 }, { ...item2 });
        winner.health = Math.min(100, winner.health + 50);
        winner.vitals.hunger = 0;
        winner.vitals.thirst = 0;
        clampTribute(winner);
        ctx.logEvent(
            fill(ctx.pickText(FEAST_TEXTS.claim), { tribute: winner.name, items: `${item1.name} and ${item2.name}` }),
            [winner.id],
            { important: true, zone: cornucopia, category: 'feast' }
        );
    }
}
