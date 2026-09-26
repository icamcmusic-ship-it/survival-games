import { GameState, Item, Tribute } from '../../models/types';
import { AUDIT12_WAVE3, QUALITY_BIAS } from '../../data/balance';
import { ITEMS } from '../../data/constants';
import { hasMutator } from '../../data/mutators';
import { SimContext } from '../context';
import { SPONSOR_BLOCS, SponsorBloc, blocWeight } from '../sponsorBlocs';
import { zoneFeatures } from '../map';
import { arenaHasLaw } from '../gamesProfile';
import { itemPoolFor, mintItem } from '../items';
import { dropParachute } from '../parachutes';
import { cycleOf } from '../memory';
import { seasonOf, sideRng } from './runState';

/**
 * AUDIT-12 wave 3 §11: the sponsor blocs as rivals, not a queue.
 *
 *  - **Bidding wars.** When a second bloc wants the same tribute nearly as much
 *    as the one that won the draw, and has the purse for it, the two bid
 *    against each other: both are charged over the odds and both parachutes
 *    come down. Under the `sponsor-auction` mutator every gift is contested.
 *  - **Arena-logical gifts.** A waterless arena's sponsors send condensate
 *    kits and purifiers, a frozen one's send warmth, a dark one's send light —
 *    the gift weight is multiplied where the arena's shortage matches the item.
 *  - **Patron's regret.** A bloc whose tribute dies within a day of its gift
 *    loses heart: its pull toward every tribute falls, for the rest of the run.
 */
const S = AUDIT12_WAVE3.sponsors;

/** The shortage the arena's sponsors answer, if it has one. */
export function arenaShortage(state: GameState): 'water' | 'warmth' | 'light' | undefined {
    const zones = state.arena.zones;
    if (zones.length === 0) return undefined;
    const dry = zones.filter(z => !zoneFeatures(z).waterSource).length / zones.length;
    if (arenaHasLaw(state, 'noWaterExceptZone') || dry >= S.dryShare) return 'water';
    const cold = zones.filter(z => z.terrain === 'ice').length / zones.length;
    if (cold >= S.coldShare) return 'warmth';
    const dark = zones.filter(z => z.terrain === 'cave').length / zones.length;
    if (dark >= S.darkShare) return 'light';
    return undefined;
}

/** Multiplier on a gift's need weight for an arena whose shortage it answers. */
export function arenaLogicalWeight(state: GameState, item: Item): number {
    const need = arenaShortage(state);
    if (!need) return 1;
    if (need === 'water' && (item.purifies || item.type === 'water')) return S.logicalWeight;
    if (need === 'warmth' && item.warmth) return S.logicalWeight;
    if (need === 'light' && item.light) return S.logicalWeight;
    return 1;
}

/** The phrase a logical gift is announced with. */
export function logicalGiftNote(state: GameState, item: Item): string | undefined {
    if (arenaLogicalWeight(state, item) === 1) return undefined;
    const need = arenaShortage(state);
    return need === 'water' ? 'Somebody in the Capitol has looked at a map of this arena: it is a condensate kit, packed for a place with no water.'
        : need === 'warmth' ? 'Whoever paid for it knew how cold the nights here get.'
            : 'Whoever paid for it knew how dark it is down there.';
}

/** Patron's regret, as a multiplier on the bloc's weight. */
export function blocRegretOf(state: GameState, blocId: string): number {
    return state.season?.blocRegret?.[blocId] ?? 1;
}

/** Recorded after every bloc-paid gift, for regret. */
export function noteBlocGift(state: GameState, t: Tribute, bloc: SponsorBloc): void {
    const s = seasonOf(state);
    (s.lastGift ?? (s.lastGift = {}))[t.id] = { bloc: bloc.id, cycle: cycleOf(state) };
}

/** Read from the per-cycle tick: a tribute who died soon after a gift. */
export function notePatronRegret(state: GameState, dead: Tribute): string | undefined {
    const gift = state.season?.lastGift?.[dead.id];
    if (!gift) return undefined;
    if (cycleOf(state) - gift.cycle > S.regretCycles) return undefined;
    const s = seasonOf(state);
    const regret = s.blocRegret ?? (s.blocRegret = {});
    regret[gift.bloc] = Math.max(S.regretFloor, Math.round((regret[gift.bloc] ?? 1) * S.regretStep * 100) / 100);
    const bloc = SPONSOR_BLOCS.find(b => b.id === gift.bloc);
    return bloc ? `${bloc.name[0].toUpperCase()}${bloc.name.slice(1)} watched their parachute go into the ground with ${dead.name}. They will be slower to open their purse again.` : undefined;
}

/**
 * After the winning bloc has paid: does a rival bid against it? Returns true
 * when a bidding war happened (and the second parachute is on its way).
 */
export function biddingWar(ctx: SimContext, t: Tribute, gift: Item, winner: SponsorBloc): boolean {
    noteBlocGift(ctx.state, t, winner);
    const purse = ctx.state.sponsorBlocBudgets;
    if (!purse) return false;
    const auction = hasMutator(ctx.state.config, 'sponsor-auction');
    const winnerWeight = blocWeight(ctx.state, t, winner);
    const rival = SPONSOR_BLOCS
        .filter(b => b.id !== winner.id && (purse[b.id] ?? 0) >= gift.value)
        .map(b => ({ b, w: blocWeight(ctx.state, t, b) * blocRegretOf(ctx.state, b.id) }))
        .filter(x => auction || x.w >= winnerWeight * (1 - S.warMargin))
        .sort((a, b) => b.w - a.w || a.b.id.localeCompare(b.b.id))[0];
    if (!rival) return false;
    const rng = sideRng(ctx.state, `bidding-${t.id}`);
    if (!auction && !rng.chance(S.warChance)) return false;
    const mult = auction ? AUDIT12_WAVE3.mutators.auctionCost : S.warCost;
    const extra = Math.round(gift.value * (mult - 1));
    purse[winner.id] = Math.max(0, (purse[winner.id] ?? 0) - extra);
    purse[rival.b.id] = Math.max(0, (purse[rival.b.id] ?? 0) - Math.round(gift.value * mult));
    const pool = itemPoolFor(ctx.state, ITEMS.filter(i => i.value >= AUDIT12_WAVE3.events.biddingWarFloor && i.id !== gift.id));
    if (pool.length === 0) return false;
    const second = mintItem(rng, rng.pick(pool), QUALITY_BIAS.parachute);
    dropParachute(ctx, t, second, rival.b.seal);
    noteBlocGift(ctx.state, t, rival.b);
    const s = seasonOf(ctx.state);
    s.biddingWars = (s.biddingWars ?? 0) + 1;
    ctx.logEvent(
        `A bidding war breaks out over ${t.name}: ${winner.name} and ${rival.b.name} both want to be seen paying for them, and neither will be outbid. Two parachutes are coming, and both purses are lighter for it.`,
        [t.id],
        { important: true, category: 'sponsor' },
    );
    return true;
}
