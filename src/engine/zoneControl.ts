import { Tribute } from '../models/types';
import { ZONE_CONTROL, QUALITY_BIAS } from '../data/balance';
import { ITEMS } from '../data/constants';
import { SimContext, getAlive } from './context';
import { allianceOf, membersOf } from './alliance';
import { giveItem, itemPhrase, mintItem } from './items';
import { addExcitement } from './audience';
import { addZoneThreat } from './memory';
import { clampTribute } from './vitals';
import { MEMORY } from '../data/balance';

/**
 * Holding ground.
 *
 * The Cornucopia was special exactly twice — at the bloodbath and at a feast —
 * and in between it was an ordinary zone with a slightly better restock timer.
 * Nothing in the simulation could hold it, defend it, or profit from it, so the
 * most recognisable location in the arena spent most of every run empty.
 *
 * A group that keeps two or more members standing at the Cornucopia across
 * consecutive cycles controls it: they draw the restocked supplies, the crowd
 * rewards the swagger, and everybody else in the arena learns it is somebody
 * else's ground. It is deliberately expensive to hold — a zone everybody knows
 * you are standing in is a zone everybody knows where to find you.
 */

function cornucopiaName(ctx: SimContext): string {
    return ctx.state.arena.zones[0]?.name ?? 'The Cornucopia';
}

export function controllingAlliance(ctx: SimContext): string | undefined {
    return ctx.state.cornucopiaHolder;
}

export function tickZoneControl(ctx: SimContext) {
    const zone = cornucopiaName(ctx);
    const collapsed = ctx.state.collapsedZones ?? [];
    if (collapsed.includes(zone)) {
        ctx.state.cornucopiaHolder = undefined;
        ctx.state.cornucopiaHeldSince = undefined;
        return;
    }

    const present = getAlive(ctx.state).filter(t => t.zone === zone);
    // Whichever alliance has the most bodies on the ground, and at least two.
    const counts = new Map<string, Tribute[]>();
    present.forEach(t => {
        if (!t.allianceId) return;
        if (!counts.has(t.allianceId)) counts.set(t.allianceId, []);
        counts.get(t.allianceId)!.push(t);
    });
    const contenders = [...counts.entries()]
        .filter(([, members]) => members.length >= ZONE_CONTROL.minHolders)
        .sort((a, b) => b[1].length - a[1].length);

    const holder = contenders[0];
    const previous = ctx.state.cornucopiaHolder;

    if (!holder) {
        if (previous) {
            ctx.logEvent(
                `Nobody is holding ${zone} any more. Whatever is left in the horn is anybody's.`,
                [],
                { important: true, zone, category: 'arena' }
            );
        }
        ctx.state.cornucopiaHolder = undefined;
        ctx.state.cornucopiaHeldSince = undefined;
        return;
    }

    const [id, members] = holder;
    const cycle = ctx.state.cycle ?? 0;

    if (previous !== id) {
        ctx.state.cornucopiaHolder = id;
        ctx.state.cornucopiaHeldSince = cycle;
        ctx.logEvent(
            `${members.map(m => m.name).join(', ')} are camped on ${zone} and not moving. `
            + `${previous ? 'The horn has changed hands.' : 'The horn belongs to somebody now.'}`,
            members.map(m => m.id),
            { important: true, zone, category: 'alliance' }
        );
        // Everybody watching learns whose ground this is.
        getAlive(ctx.state).forEach(t => {
            if (members.some(m => m.id === t.id)) return;
            addZoneThreat(ctx.state, t, zone, MEMORY.hazardThreat);
        });
        return;
    }

    // Held across cycles: this is where it starts paying.
    const heldFor = cycle - (ctx.state.cornucopiaHeldSince ?? cycle);
    if (heldFor < ZONE_CONTROL.payoutEveryCycles) return;
    ctx.state.cornucopiaHeldSince = cycle;

    const record = allianceOf(ctx.state, id);
    const roster = record ? membersOf(ctx.state, id) : members;
    const beneficiary = ctx.rng.pick(members);
    const pool = ITEMS.filter(i => i.value >= ZONE_CONTROL.minItemValue);
    const spoils = mintItem(ctx.rng, ctx.rng.pick(pool.length > 0 ? pool : ITEMS), QUALITY_BIAS.feast);
    giveItem(beneficiary, spoils);
    roster.forEach(m => {
        addExcitement(m, ZONE_CONTROL.excitement);
        m.vitals.hunger = Math.max(0, m.vitals.hunger - ZONE_CONTROL.supplyRelief);
        m.vitals.thirst = Math.max(0, m.vitals.thirst - ZONE_CONTROL.supplyRelief);
        clampTribute(m);
    });
    ctx.logEvent(
        `Holding ${zone} pays: the Gamemakers restock the horn and ${beneficiary.name} takes ${itemPhrase(spoils)} straight off the top. `
        + `Nobody else in the arena gets near it.`,
        roster.map(m => m.id),
        { important: true, zone, category: 'loot' }
    );
}
