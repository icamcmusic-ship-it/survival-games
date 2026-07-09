import { SimContext, getAlive } from './context';
import { ITEMS } from '../data/constants';
import { getArchetypeModifiers } from '../data/archetypes';

export function processSponsors(ctx: SimContext) {
    const alive = getAlive(ctx.state);
    alive.forEach(t => {
        const sponsorScore = t.excitementRating + t.sponsorTrust + getArchetypeModifiers(t).sponsorAppeal;
        const chance = 0.3 + getArchetypeModifiers(t).sponsorAppeal / 100;
        if (sponsorScore > 100 && ctx.rng.chance(Math.min(0.9, chance * ctx.state.config.sponsorGenerosity))) {
            const gift = ctx.rng.pick(ITEMS.filter(i => i.value > 20));
            t.inventory.push(gift);
            t.excitementRating -= 50; // Consume some rating
            ctx.logEvent(`${t.name} receives a sponsor gift: ${gift.name}!`, [t.id], true);
        }
    });
}
