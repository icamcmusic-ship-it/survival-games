import { SimContext, getAlive } from './context';
import { ITEMS } from '../data/constants';
import { SPONSOR_TEXTS } from '../data/flavorText';
import { clampTribute } from './vitals';
import { itemPhrase } from './items';

export function processSponsors(ctx: SimContext) {
    const alive = getAlive(ctx.state);
    alive.forEach(t => {
        const sponsorScore = t.excitementRating + t.sponsorTrust;
        if (sponsorScore > 100 && ctx.rng.chance(Math.min(0.9, 0.3 * ctx.state.config.sponsorGenerosity))) {
            // Clone: pushing the shared ITEMS entry let one tribute's combat
            // durability loss propagate to every future copy of that item.
            const gift = { ...ctx.rng.pick(ITEMS.filter(i => i.value > 20)) };
            t.inventory.push(gift);
            t.excitementRating = Math.max(0, t.excitementRating - 50);
            clampTribute(t);

            const text = ctx.pickText(SPONSOR_TEXTS)
                .split('{tribute}').join(t.name)
                .split('{item}').join(itemPhrase(gift))
                .split('{zone}').join(t.zone);
            ctx.logEvent(text, [t.id], { important: true, category: 'sponsor' });
        }
    });
}
