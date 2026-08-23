import { GameState, Item, Tribute } from '../models/types';
import { ITEMS } from '../data/constants';
import { SPONSOR_MARKET, QUALITY_BIAS } from '../data/balance';
import { SPONSOR_BLOCS } from './sponsorBlocs';
import { RNG } from '../utils/rng';
import { giveItem, itemPhrase, mintItem } from './items';
import { ensureMemory } from './memory';
import { clampTribute } from './vitals';

/**
 * The player as a sponsor.
 *
 * SIDE-03: the header carried a wallet of Capitol Coins whose only use was a
 * pre-Games wager — a bet is a dead end, placed once and then watched. The
 * whole sponsorship system, meanwhile, ran without the player in it at all,
 * which left the single most obvious connection in the product unmade: in the
 * source material the audience *is* the sponsor, and a parachute is the one
 * thing anyone outside the arena can actually do.
 *
 * Spending is deliberately expensive and deliberately escalating, on the same
 * shape as the mentor's credibility and the crowd's compounding rarity gate: a
 * first parachute is affordable, a fourth is a decision about the whole wallet.
 * The coin economy becomes a verb.
 */

/** What the Capitol will put on a parachute for a paying sponsor. */
export const SPONSORABLE_IDS = [
    'water', 'bread', 'dried-meat', 'tablets', 'ointment', 'medkit', 'antidote',
    'rope', 'matches', 'backpack', 'sleeping-bag', 'lantern', 'net', 'whetstone',
    'bracers', 'vest', 'knife', 'spear', 'sword', 'bow',
    // §8.3: the widened catalogue's sensible parachute candidates.
    'waterskin', 'iodine', 'groosling', 'lamb-stew', 'bandages', 'morphling',
    'fishing-kit', 'charcoal-filter', 'glow-stick', 'thermal-cloak', 'helmet',
] as const;

export function sponsorableItems(): Item[] {
    return SPONSORABLE_IDS
        .map(id => ITEMS.find(i => i.id === id))
        .filter((i): i is Item => i !== undefined);
}

/**
 * The price the Capitol quotes, right now, for this tribute.
 *
 * Three things move it: what the item is, how deep into the Games it is (the
 * later it gets, the more the Capitol can charge), and how many parachutes this
 * tribute has already had. A tribute the crowd is already funding is expensive
 * to add to; a tribute nobody is watching is cheap, which is the only advantage
 * an unpopular tribute ever gets.
 */
/**
 * §6.6: how hard the AI blocs are currently leaning toward this tribute —
 * the player is bidding in the same room. Only blocs whose purse could still
 * cover the item count as live demand.
 */
export function blocDemandFor(state: GameState, t: Tribute, itemValue: number): number {
    const budgets = state.sponsorBlocBudgets;
    const live = SPONSOR_BLOCS.filter(b => (budgets?.[b.id] ?? b.budget) >= itemValue * 0.5);
    if (live.length === 0) return 0;
    return Math.max(0, ...live.map(b => b.prefer(state, t)));
}

export function sponsorCost(state: GameState, t: Tribute, item: Item): number {
    const prior = ensureMemory(t).giftsReceived;
    const dayScale = 1 + Math.max(0, state.day) * SPONSOR_MARKET.perDay;
    const repeat = Math.pow(SPONSOR_MARKET.repeatMultiplier, prior);
    // Popularity is the Capitol's pricing signal, not a discount for the player.
    const demand = 1 + (t.sponsorTrust - 50) / SPONSOR_MARKET.trustDivisor;
    // §6.6: the blocs' interest is demand pressure on the same quote — a
    // tribute the syndicates are already eyeing costs more to reach first.
    const blocPressure = 1 + Math.min(SPONSOR_MARKET.blocDemandCap,
        blocDemandFor(state, t, item.value) * SPONSOR_MARKET.blocDemandPressure);
    const raw = item.value * SPONSOR_MARKET.valueMultiplier * dayScale * repeat * Math.max(0.6, demand) * blocPressure;
    return Math.max(SPONSOR_MARKET.minCost, Math.round(raw / 5) * 5);
}

export interface SponsorResult {
    ok: boolean;
    cost: number;
    message: string;
}

/**
 * Sends the parachute. Mutates the live state — the caller is responsible for
 * having taken the coins and for re-snapshotting afterwards.
 */
export function sendPlayerParachute(state: GameState, tributeId: string, itemId: string): SponsorResult {
    const t = state.tributes.find(o => o.id === tributeId);
    const base = ITEMS.find(i => i.id === itemId);
    if (!t || !base) return { ok: false, cost: 0, message: 'That parachute cannot be sent.' };
    if (t.status !== 'alive') return { ok: false, cost: 0, message: `${t.name} is beyond the reach of a parachute.` };
    if (state.phase !== 'day' && state.phase !== 'night' && state.phase !== 'feast') {
        return { ok: false, cost: 0, message: 'Parachutes can only be sent once the tributes are in the arena.' };
    }

    const cost = sponsorCost(state, t, base);
    // Seeded off the run and the gift count so a replayed run is identical.
    const rng = new RNG(`${state.seed}-player-gift-${t.id}-${ensureMemory(t).giftsReceived}`);
    const gift = mintItem(rng, base, QUALITY_BIAS.parachute);
    const dropped = giveItem(t, gift);

    ensureMemory(t).giftsReceived += 1;
    // §6.6: the blocs saw the parachute land too. For a while they treat the
    // tribute as covered — see `processSponsors`.
    state.playerGiftCycle = state.playerGiftCycle ?? {};
    state.playerGiftCycle[t.id] = state.cycle ?? 0;
    t.sponsorTrust = Math.min(100, t.sponsorTrust + SPONSOR_MARKET.trustGain);
    t.vitals.sanity = Math.min(100, t.vitals.sanity + SPONSOR_MARKET.sanityGain);
    clampTribute(t);

    state.log.push({
        id: `player-gift-${state.logCounter = (state.logCounter ?? 0) + 1}`,
        day: state.day,
        phase: state.phase,
        text: `A parachute comes down through the canopy over ${t.zone} with no name on it. ${t.name} opens it and finds ${itemPhrase(gift)}. Somebody in the Capitol is watching them specifically.`,
        tributesInvolved: [t.id],
        important: true,
        category: 'sponsor',
    });
    if (dropped.length > 0) {
        state.log.push({
            id: `player-gift-drop-${state.logCounter = (state.logCounter ?? 0) + 1}`,
            day: state.day,
            phase: state.phase,
            text: `${t.name} has to leave ${dropped.map(i => i.name).join(', ')} behind to carry it.`,
            tributesInvolved: [t.id],
            important: false,
            category: 'loot',
        });
    }

    return { ok: true, cost, message: `${itemPhrase(gift)} is on its way to ${t.name}.` };
}
