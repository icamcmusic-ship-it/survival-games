import { SimContext, getAlive } from './context';
import { ITEMS } from '../data/constants';
import { SPONSORS } from '../data/balance';
import { SPONSOR_TEXTS } from '../data/flavorText';
import { clampTribute } from './vitals';
import { itemPhrase } from './items';
import { ensureMemory } from './memory';
import { Tribute } from '../models/types';

/**
 * Compounding rarity for repeat gifts.
 *
 * The training phase already had the best-designed gate in the codebase: an
 * exponential decay where every step past the ordinary band costs another roll.
 * Sponsors had nothing of the kind — a popular tribute simply kept drawing
 * parachutes at a flat rate, which is both undramatic and unbalanced. The same
 * shape now governs the gift stream: your first parachute is likely, your
 * fourth is a story.
 */
export function giftChance(t: Tribute, generosity: number): number {
    const prior = ensureMemory(t).giftsReceived;
    const decayed = SPONSORS.baseGiftChance * Math.pow(SPONSORS.repeatDecay, prior);
    return Math.min(SPONSORS.maxGiftChance, Math.max(SPONSORS.repeatFloor, decayed * generosity));
}

/**
 * The value band a gift lands in, behind its own decaying gate. A knife is
 * cheap and common; the trident and the first aid kit are what the crowd has to
 * be genuinely invested to send.
 */
function rollGiftTier(ctx: SimContext, t: Tribute): number {
    let tier = 0;
    const merit = 0.6 + t.sponsorTrust / 120 + (t.fanFavourite ? 0.3 : 0);
    for (let step = 1; step <= 3; step++) {
        const chance = SPONSORS.rarityGateBase * Math.pow(SPONSORS.rarityGateDecay, step - 1) * merit;
        if (ctx.rng.chance(Math.min(0.7, chance))) tier = step;
        else break;
    }
    return tier;
}

const TIER_FLOORS = [20, 35, 50, 65];

export function processSponsors(ctx: SimContext) {
    const alive = getAlive(ctx.state);
    alive.forEach(t => {
        const sponsorScore = t.excitementRating + t.sponsorTrust;
        if (sponsorScore <= SPONSORS.giftThreshold) return;
        if (!ctx.rng.chance(giftChance(t, ctx.state.config.sponsorGenerosity))) return;

        const tier = rollGiftTier(ctx, t);
        const floor = TIER_FLOORS[tier];
        const pool = ITEMS.filter(i => i.value > floor);
        // Clone: pushing the shared ITEMS entry let one tribute's combat
        // durability loss propagate to every future copy of that item.
        const gift = { ...ctx.rng.pick(pool.length > 0 ? pool : ITEMS.filter(i => i.value > 20)) };
        t.inventory.push(gift);
        t.excitementRating = Math.max(0, t.excitementRating - SPONSORS.giftExcitementCost);
        ensureMemory(t).giftsReceived += 1;
        clampTribute(t);

        const text = ctx.pickText(SPONSOR_TEXTS)
            .split('{tribute}').join(t.name)
            .split('{item}').join(itemPhrase(gift))
            .split('{zone}').join(t.zone);
        ctx.logEvent(
            tier >= 2
                ? `${text} The Capitol does not send these lightly — this is the ${ordinal(ensureMemory(t).giftsReceived)} parachute for ${t.name}.`
                : text,
            [t.id],
            { important: true, category: 'sponsor' }
        );
    });
}

function ordinal(n: number): string {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return `${n}${suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]}`;
}
