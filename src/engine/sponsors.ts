import { SimContext, getAlive } from './context';
import { profOf } from './proficiency';
import { ITEMS } from '../data/constants';
import { COMPOSURE, GIFT_NEED, QUELL_MECHANICS, SPONSORS, SPONSOR_MARKET, PROFICIENCY } from '../data/balance';
import { composureOf } from './composure';
import { SPONSOR_TEXTS } from '../data/flavorText';
import { drawFromBloc } from './sponsorBlocs';
import { clampTribute } from './vitals';
import { giveItem, itemPhrase } from './items';
import { ensureMemory } from './memory';
import { mentorGenerosity, processMentorPleas } from './mentors';
import { Item, Tribute } from '../models/types';
import { arenaHasLaw, wildcardIs } from './gamesProfile';
import { mintItem } from './items';
import { QUALITY_BIAS } from '../data/balance';

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
export function giftChance(t: Tribute, generosity: number, day = 99): number {
    const prior = ensureMemory(t).giftsReceived;
    const decayed = SPONSORS.baseGiftChance * Math.pow(SPONSORS.repeatDecay, prior);
    // The mentor is the person who actually places the gift, so their district's
    // record scales the whole stream rather than being a flat bonus on top of it.
    // The chariot parade's buzz rides on top for the first few days: the whole
    // point of a parade is sponsors, and a memorable angle keeps the phones
    // ringing until the arena gives them something newer to talk about.
    const paradeGlow = day <= SPONSORS.paradeBuzzDays
        ? 1 + Math.max(0, t.paradeBuzz ?? 0) * SPONSORS.paradeBuzzPerPull
        : 1;
    const pull = decayed * generosity * mentorGenerosity(t) * paradeGlow;
    return Math.min(SPONSORS.maxGiftChance, Math.max(SPONSORS.repeatFloor, pull));
}

/**
 * The value band a gift lands in, behind its own decaying gate. A knife is
 * cheap and common; the trident and the first aid kit are what the crowd has to
 * be genuinely invested to send.
 */
function rollGiftTier(ctx: SimContext, t: Tribute): number {
    let tier = 0;
    // §3.4: a keyed-up tribute reads as a contender; a rattled one reads as
    // damaged goods. The blocs price it in.
    // §1.4: a tribute who spent the training floor at the sponsor pitch booth
    // and the mock-interview couch is genuinely better at asking, and the
    // parachutes reflect it. Before `persuasion` existed those three days
    // bought nothing at all.
    const merit = 0.6 + t.sponsorTrust / 120 + (t.fanFavourite ? 0.3 : 0)
        + composureOf(t) * COMPOSURE.sponsorMeritWeight
        + profOf(t, 'persuasion') * PROFICIENCY.persuasionSponsorWeight / 100;
    for (let step = 1; step <= 3; step++) {
        const chance = SPONSORS.rarityGateBase * Math.pow(SPONSORS.rarityGateDecay, step - 1) * merit;
        if (ctx.rng.chance(Math.min(0.7, chance))) tier = step;
        else break;
    }
    return tier;
}

const TIER_FLOORS = [20, 35, 50, 65];

/**
 * What this tribute is actually short of, weighted.
 *
 * The gift used to be a uniform pick from a value band, which is how a tribute
 * dying of thirst received a Sword. A parachute in the source material is a
 * message: it is always the thing you needed and never quite as much of it as
 * you wanted. The mentor plea in `mentors.ts` already worked this way for
 * emergencies; this is the same idea for the ordinary stream.
 */
export function needWeight(t: Tribute, item: Item): number {
    let weight = 1;
    if (item.type === 'water') weight += t.vitals.thirst / GIFT_NEED.thirstDivisor;
    if (item.type === 'food') weight += t.vitals.hunger / GIFT_NEED.hungerDivisor;
    if (item.type === 'medical') {
        if (t.injuries.bleeding || t.injuries.infected) weight += GIFT_NEED.bleedingOrInfected;
        if (t.injuries.poisoned && item.id === 'antidote') weight += GIFT_NEED.matchedAntidote;
        if (t.injuries.burned && item.id === 'ointment') weight += GIFT_NEED.matchedOintment;
        weight += Math.max(0, (GIFT_NEED.woundedBelowHealth - t.health) / GIFT_NEED.woundedPerTenHealth);
    }
    if (item.type === 'weapon') {
        weight += t.inventory.some(i => i.type === 'weapon')
            ? GIFT_NEED.weaponWhenArmed
            : GIFT_NEED.weaponWhenUnarmed;
        // A tribute the crowd has watched fight gets sent something to fight with.
        weight += Math.min(GIFT_NEED.weaponPerKillCap, t.kills);
    }
    if (item.type === 'armour') {
        weight += t.health < GIFT_NEED.woundedBelowHealth ? GIFT_NEED.armourWhenHurt : GIFT_NEED.armourWhenWhole;
    }
    if (item.warmth) weight += t.vitals.fatigue / GIFT_NEED.warmthFatigueDivisor;
    if (item.purifies) weight += t.vitals.thirst / GIFT_NEED.purifierThirstDivisor;
    if (item.light) weight += GIFT_NEED.lightBonus;
    // Nobody parachutes a second one of something they are already carrying.
    if (t.inventory.some(i => i.id === item.id)) weight *= GIFT_NEED.duplicateMultiplier;
    return Math.max(GIFT_NEED.minWeight, weight);
}

export function pickNeededGift(ctx: SimContext, t: Tribute, pool: Item[]): Item {
    const weights = pool.map(i => needWeight(t, i));
    let roll = ctx.rng.nextFloat() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) {
        roll -= weights[i];
        if (roll <= 0) return pool[i];
    }
    return pool[pool.length - 1];
}

export function processSponsors(ctx: SimContext) {
    const alive = getAlive(ctx.state);
    // Pleas resolve first: a tribute their mentor just rescued should not also
    // draw a crowd parachute in the same cycle.
    const rescued = processMentorPleas(ctx, alive);
    alive.forEach(t => {
        if (rescued.has(t.id)) return;
        // `sponsorsFixedZone`: gifts only ever reach a tribute standing in
        // the arena's one drop zone — sponsorship becomes a race to be there,
        // not a reward for wherever a tribute happens to be.
        if (arenaHasLaw(ctx.state, 'sponsorsFixedZone') && t.zone !== ctx.state.arena.lawZone) return;
        // §5.1 `noSponsors`: a communications blackout arena. Nothing the
        // Capitol wants to send can be got down to the floor, which turns
        // sponsor trust into pure reputation and makes the Cornucopia the only
        // supply line there is.
        if (arenaHasLaw(ctx.state, 'noSponsors')) return;
        // `quell-sponsors-by-vote`: gifts are voted for by the audience, not
        // bought — proven competence (sponsorTrust) stops earning aid, and
        // only how much the crowd likes watching them does.
        const sponsorScore = wildcardIs(ctx.state, 'quell-sponsors-by-vote')
            ? t.excitementRating
            : t.excitementRating + t.sponsorTrust;
        if (sponsorScore <= SPONSORS.giftThreshold) return;
        // Arena.sponsorMultiplier: how much the Capitol's attention is worth
        // in this arena specifically (Salt Mirror's total visibility vs. the
        // Vault's dead cameras) — layered on top of the run's own generosity.
        let generosity = ctx.state.config.sponsorGenerosity * (ctx.state.arena.sponsorMultiplier ?? 1);
        // `quell-blood-debt`: a tribute who has killed is marked, and the
        // Capitol pays the marked less.
        if (wildcardIs(ctx.state, 'quell-blood-debt') && t.kills > 0) generosity *= QUELL_MECHANICS.bloodDebtGenerosityMult;
        // §6.6: a player parachute landed recently — the blocs read the
        // tribute as somebody else's project and sit on their purses.
        const playerGiftAt = ctx.state.playerGiftCycle?.[t.id];
        if (playerGiftAt !== undefined
            && (ctx.state.cycle ?? 0) - playerGiftAt < SPONSOR_MARKET.coveredCycles) {
            generosity *= SPONSOR_MARKET.coveredGiftMultiplier;
        }
        if (!ctx.rng.chance(giftChance(t, generosity, ctx.state.day))) return;

        const tier = rollGiftTier(ctx, t);
        const floor = TIER_FLOORS[tier];
        const pool = ITEMS.filter(i => i.value > floor);
        // Clone: pushing the shared ITEMS entry let one tribute's combat
        // durability loss propagate to every future copy of that item.
        const candidates = pool.length > 0 ? pool : ITEMS.filter(i => i.value > GIFT_NEED.fallbackItemValue);
        const gift = mintItem(ctx.rng, pickNeededGift(ctx, t, candidates), QUALITY_BIAS.parachute);
        // §9.4: somebody specific pays for this. When every purse that would
        // back this tribute is empty, the parachute does not come.
        const bloc = drawFromBloc(ctx, t, gift.value);
        if (!bloc) return;
        giveItem(t, gift);
        t.excitementRating = Math.max(0, t.excitementRating - SPONSORS.giftExcitementCost);
        ensureMemory(t).giftsReceived += 1;
        clampTribute(t);

        const text = ctx.pickText(SPONSOR_TEXTS)
            .split('{tribute}').join(t.name)
            .split('{item}').join(itemPhrase(gift))
            .split('{zone}').join(t.zone);
        ctx.logEvent(
            tier >= 2
                ? `${text} The Capitol does not send these lightly — this is the ${ordinal(ensureMemory(t).giftsReceived)} parachute for ${t.name}. ${bloc.seal}`
                : `${text} ${bloc.seal}`,
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
