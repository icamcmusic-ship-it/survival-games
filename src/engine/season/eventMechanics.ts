import { Tribute } from '../../models/types';
import { ArenaEventDef } from '../../data/arenaFlavor';
import { AUDIT12_WAVE3, QUALITY_BIAS } from '../../data/balance';
import { ITEMS } from '../../data/constants';
import { SimContext, getAlive } from '../context';
import { adjustRel, adjustTrust, getRel } from '../relationships';
import { allied } from '../alliance';
import { loseSanity } from '../sanityBands';
import { SPONSOR_BLOCS, blocWeight } from '../sponsorBlocs';
import { giveItem, itemPhrase, itemPoolFor, mintItem } from '../items';
import { cycleOf } from '../memory';
import { clampTribute } from '../vitals';
import { seasonOf, sideRng } from './runState';

/**
 * AUDIT-12 wave 3 §13: three §10 beats promoted from text lines to mechanics,
 * and the old victor's cache made real.
 *
 *  - **Bidding War** — the two parachutes are paid for by the two blocs that
 *    want this tribute most, out of their real purses, and the second one
 *    carries a real item.
 *  - **Paranoia Night** — allies standing in the zone in the dark stop trusting
 *    each other, and it costs them sleep.
 *  - **Truce of the Wounded** — the other wounded tribute is named, the two of
 *    them hold a truce for a few cycles (regard floored, shared water), and the
 *    regard it leaves outlasts it.
 *  - **Old victor's cache** — the kit is what a real Hall of Fame victor was
 *    carrying when they were crowned, and the chronicle says whose.
 */
const E = AUDIT12_WAVE3.events;

const BIDDING_WAR = 'A sponsor bidding war';
const TRUCE = 'The truce of the wounded';
const PARANOIA = 'Killed in the confusion of paranoia night';
const CACHE_ID = 'universal-old-victors-cache';

/** Before the event resolves: swap in what the run actually has. */
export function adaptArenaEvent(ctx: SimContext, event: ArenaEventDef): ArenaEventDef {
    if (event.id !== CACHE_ID) return event;
    const cache = ctx.state.campaign?.ledger?.oldVictorCache;
    const itemId = cache?.itemIds.find(id => ITEMS.some(i => i.id === id));
    if (!cache || !itemId) return event;
    return { ...event, grantItem: itemId };
}

const wounded = (t: Tribute) => t.health < E.woundedBelow || Object.values(t.injuries).some(Boolean);

/** After the event resolved on `t`. */
export function applyEventMechanic(ctx: SimContext, t: Tribute, event: ArenaEventDef): void {
    if (event.id === CACHE_ID) return openCache(ctx, t);
    if (event.cause === BIDDING_WAR) return biddingWarBeat(ctx, t);
    if (event.cause === TRUCE) return truceOfTheWounded(ctx, t);
    if (event.cause === PARANOIA) return paranoiaNight(ctx, t);
}

function openCache(ctx: SimContext, t: Tribute) {
    const cache = ctx.state.campaign?.ledger?.oldVictorCache;
    const s = seasonOf(ctx.state);
    if (!cache || s.oldCacheOpened) return;
    s.oldCacheOpened = true;
    const rest = cache.itemIds.filter(id => ITEMS.some(i => i.id === id)).slice(1, 2);
    const rng = sideRng(ctx.state, `cache-${t.id}`);
    rest.forEach(id => giveItem(t, mintItem(rng, ITEMS.find(i => i.id === id)!, QUALITY_BIAS.scavenged)));
    clampTribute(t);
    ctx.logEvent(
        `The oilcloth has a name inked inside it: ${cache.fromName}, District ${cache.district}, who came home from ${cache.arenaName}. `
        + `Everything in the kit is what ${cache.fromName} was carrying on the day they were crowned.`,
        [t.id],
        { important: true, category: 'loot', zone: t.zone, fact: `${t.name} found ${cache.fromName}'s victor's cache.` },
    );
}

function biddingWarBeat(ctx: SimContext, t: Tribute) {
    const purse = ctx.state.sponsorBlocBudgets;
    if (!purse) return;
    const [a, b] = SPONSOR_BLOCS
        .map(bl => ({ bl, w: blocWeight(ctx.state, t, bl) }))
        .sort((x, y) => y.w - x.w || x.bl.id.localeCompare(y.bl.id));
    if (!a || !b) return;
    const rng = sideRng(ctx.state, `bidding-beat-${t.id}`);
    const pool = itemPoolFor(ctx.state, ITEMS.filter(i => i.value >= E.biddingWarFloor));
    if (pool.length === 0) return;
    const item = mintItem(rng, rng.pick(pool), QUALITY_BIAS.parachute);
    purse[a.bl.id] = Math.max(0, (purse[a.bl.id] ?? 0) - item.value);
    purse[b.bl.id] = Math.max(0, (purse[b.bl.id] ?? 0) - item.value);
    giveItem(t, item);
    const s = seasonOf(ctx.state);
    s.biddingWars = (s.biddingWars ?? 0) + 1;
    ctx.logEvent(
        `The second parachute was ${b.bl.name}'s, sent to be seen outbidding ${a.bl.name}. ${t.name} keeps both: ${itemPhrase(item)} as well.`,
        [t.id],
        { category: 'sponsor', zone: t.zone },
    );
}

function truceOfTheWounded(ctx: SimContext, t: Tribute) {
    const other = getAlive(ctx.state)
        .filter(o => o.id !== t.id && o.zone === t.zone && wounded(o) && !allied(o, t))
        .sort((x, y) => getRel(t, x.id) - getRel(t, y.id) || x.id.localeCompare(y.id))[0];
    if (!other) return;
    const s = seasonOf(ctx.state);
    (s.truces ?? (s.truces = [])).push({ a: t.id, b: other.id, until: cycleOf(ctx.state) + E.truceCycles });
    [[t, other], [other, t]].forEach(([x, y]) => {
        adjustRel(x, y.id, E.truceRegard);
        adjustTrust(x, y.id, E.truceRegard / 2);
        x.vitals.thirst = Math.max(0, x.vitals.thirst - 6);
        clampTribute(x);
    });
    ctx.logEvent(
        `The other one is ${other.name}. Neither of them says the word truce. Neither of them reaches for a weapon for the rest of the day, either.`,
        [t.id, other.id],
        { category: 'alliance', zone: t.zone, fact: `${t.name} and ${other.name} held a truce of the wounded.` },
    );
}

/** Keeps a live truce holding: regard never drops below the truce floor while it lasts. */
export function holdTruces(ctx: SimContext): void {
    const s = ctx.state.season;
    if (!s?.truces?.length) return;
    const now = cycleOf(ctx.state);
    const byId = new Map(ctx.state.tributes.map(t => [t.id, t] as const));
    s.truces = s.truces.filter(tr => {
        const a = byId.get(tr.a);
        const b = byId.get(tr.b);
        if (!a || !b || a.status !== 'alive' || b.status !== 'alive' || now > tr.until) return false;
        if (getRel(a, b.id) < E.truceRegard) adjustRel(a, b.id, E.truceRegard - getRel(a, b.id));
        if (getRel(b, a.id) < E.truceRegard) adjustRel(b, a.id, E.truceRegard - getRel(b, a.id));
        return true;
    });
}

function paranoiaNight(ctx: SimContext, t: Tribute) {
    const allies = getAlive(ctx.state).filter(o => o.id !== t.id && o.zone === t.zone && allied(o, t));
    const s = seasonOf(ctx.state);
    s.paranoiaNights = (s.paranoiaNights ?? 0) + 1;
    if (allies.length === 0) return;
    [t, ...allies].forEach(x => {
        [t, ...allies].forEach(y => { if (x.id !== y.id) adjustTrust(x, y.id, E.paranoiaTrust); });
        loseSanity(x, E.paranoiaSanity);
        clampTribute(x);
    });
    ctx.logEvent(
        `Nobody in ${t.zone} sleeps again tonight. ${[t, ...allies].map(x => x.name).join(', ')} sit with their backs to the rock and their eyes on each other until the sky goes grey.`,
        [t.id, ...allies.map(a => a.id)],
        { category: 'sanity', zone: t.zone },
    );
}
