import { SimContext, getAlive } from './context';
import { ITEMS } from '../data/constants';

export function processSponsors(ctx: SimContext) {
    const alive = getAlive(ctx.state);
    alive.forEach(t => {
        const sponsorScore = t.excitementRating + t.sponsorTrust;
        if (sponsorScore > 100 && ctx.rng.chance(0.3)) {
            const gift = ctx.rng.pick(ITEMS.filter(i => i.value > 20));
            t.inventory.push(gift);
            t.excitementRating -= 50; // Consume some rating
            ctx.logEvent(`${t.name} receives a sponsor gift: ${gift.name}!`, [t.id], true);
        }
    });
}
