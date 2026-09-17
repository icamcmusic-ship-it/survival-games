import { SimContext, getAlive } from './context';
import { Tribute } from '../models/types';
import { ARENA_EVENT_PACKS, ArenaSetPiece, CONVERGENCE, packFor } from '../data/arenaEventPacks';
import { LAW_LABELS } from '../data/arenaBriefing';
import { arenaLaws } from './gamesProfile';
import { applyDamage, checkDeath } from './combat';
import { clampTribute } from './vitals';
import { startZoneEffect } from './zoneEffects';
import { dropSupplies } from './zoneEffects';
import { severEdge, getZone, zoneFeatures } from './map';
import { engageMutt, rosterFor } from './mutts';
import { noteSighting } from './memory';
import { ARENA_EVENTS, ESCALATION } from '../data/balance';
import { RNG } from '../utils/rng';

/**
 * §3/§11 (requests): the arena's set pieces, and the convergence that closes
 * every run.
 *
 * The plan is drawn once, at the bloodbath, from the run's own seed — so the
 * same seed produces the same Games with the same interventions on the same
 * days, which every other part of this engine already promises. Two ordinary
 * set pieces is the default; laws that make the arena more active buy more
 * slots, capped, so a stacked arena is genuinely busier without becoming
 * weather.
 *
 * The convergence is not in the plan and is not scheduled. It fires on the
 * field shrinking, once, and after it fires the arena never reopens.
 */

/** How many ordinary set pieces this arena's laws entitle the run to. */
export function plannedEventCount(ctx: SimContext): number {
    const extra = arenaLaws(ctx.state)
        .reduce((sum, law) => sum + (LAW_LABELS[law]?.extraEvents ?? 0), 0);
    return Math.min(
        ARENA_EVENTS.maxPerRun,
        ARENA_EVENTS.basePerRun + Math.min(extra, ARENA_EVENTS.maxLawExtras),
    );
}

/**
 * Draw this run's set pieces and the days they land on. Called once, from the
 * bloodbath, before anybody has moved.
 */
export function planArenaEvents(ctx: SimContext) {
    if (ctx.state.arenaEventPlan) return;
    const rng = new RNG(`${ctx.state.seed}-arena-events`);
    const pool = packFor(ctx.state.arena).events.filter(e => e.kind !== 'convergence');
    const wanted = plannedEventCount(ctx);
    const chosen = rng.shuffle(pool).slice(0, Math.min(wanted, pool.length));

    // Spread them out: two set pieces on consecutive days read as one long
    // event, which is the opposite of what a set piece is for.
    const used: number[] = [];
    ctx.state.arenaEventPlan = chosen.map(event => {
        const min = event.minDay ?? ARENA_EVENTS.defaultMinDay;
        const max = Math.max(min, event.maxDay ?? ARENA_EVENTS.defaultMaxDay);
        let day = rng.nextInt(min, max);
        let guard = 12;
        while (guard-- > 0 && used.some(d => Math.abs(d - day) < ARENA_EVENTS.minDaysApart)) {
            day = rng.nextInt(min, max);
        }
        used.push(day);
        return { id: event.id, day };
    }).sort((a, b) => a.day - b.day);
    ctx.state.arenaEventsFired = [];
}

/** Every set piece in the roster, by id — including the shared convergence. */
function setPieceById(id: string): ArenaSetPiece | undefined {
    if (id === CONVERGENCE.id) return CONVERGENCE;
    for (const pack of Object.values(ARENA_EVENT_PACKS)) {
        const found = pack.events.find(e => e.id === id);
        if (found) return found;
    }
    return packFor({ id: 'universal' }).events.find(e => e.id === id);
}

/** Zones still in play, Cornucopia excluded unless it is all that is left. */
function liveZones(ctx: SimContext): string[] {
    const collapsed = ctx.state.collapsedZones ?? [];
    return ctx.state.arena.zones.map(z => z.name).filter(n => !collapsed.includes(n));
}

/**
 * Fire any set piece scheduled for today, then test the convergence. Called
 * once per day phase from `processDayNight`.
 */
export function tickArenaEvents(ctx: SimContext) {
    planArenaEvents(ctx);
    const fired = ctx.state.arenaEventsFired ?? (ctx.state.arenaEventsFired = []);
    (ctx.state.arenaEventPlan ?? []).forEach(entry => {
        if (fired.includes(entry.id)) return;
        if (ctx.state.day < entry.day) return;
        const event = setPieceById(entry.id);
        if (!event) { fired.push(entry.id); return; }
        fired.push(entry.id);
        runSetPiece(ctx, event);
    });
    maybeConverge(ctx);
}

/** Fills `{zones}` and logs the announcement as a Gamemaker headline. */
function announce(ctx: SimContext, event: ArenaSetPiece, zones: string[]) {
    ctx.logEvent(
        event.announce.replace('{zones}', zones.length > 0 ? zones.join(', ') : 'the arena'),
        [],
        { important: true, category: 'gamemaker' },
    );
}

function runSetPiece(ctx: SimContext, event: ArenaSetPiece) {
    const rng = new RNG(`${ctx.state.seed}-setpiece-${event.id}`);
    const zones = liveZones(ctx);
    if (zones.length === 0) return;

    switch (event.kind) {
        case 'effectSweep': {
            const hit = rng.shuffle(zones).slice(0, Math.min(event.zones ?? 3, zones.length));
            announce(ctx, event, hit);
            hit.forEach(zone => startZoneEffect(ctx, zone, event.effect ?? 'stripped', false, 2));
            break;
        }
        case 'severRoutes': {
            const cut: string[] = [];
            rng.shuffle(zones).forEach(name => {
                if (cut.length >= (event.amount ?? 4)) return;
                const zone = getZone(ctx.state.arena, name);
                if (!zone) return;
                // Never cut a zone's last route: an unreachable sector with
                // somebody in it is a tribute who cannot participate in their
                // own Games.
                const open = zone.adjacent.filter(n => zones.includes(n));
                if (open.length <= 1) return;
                const target = rng.pick(open);
                severEdge(ctx.state, name, target);
                cut.push(`${name} to ${target}`);
            });
            announce(ctx, event, cut);
            break;
        }
        case 'supplyDrop': {
            announce(ctx, event, []);
            dropSupplies(ctx);
            break;
        }
        case 'muttRelease': {
            announce(ctx, event, []);
            const roster = rosterFor(ctx);
            if (roster.length === 0) break;
            getAlive(ctx.state).forEach(t => {
                const zone = getZone(ctx.state.arena, t.zone);
                // Under real cover is under real cover. A release is a reason
                // to be hiding, not a tax on being alive.
                if (zone && zoneFeatures(zone).cover > ARENA_EVENTS.muttReleaseCoverFloor) return;
                if (!rng.chance(ARENA_EVENTS.muttReleaseChance)) return;
                engageMutt(ctx, t, rng.pick(roster));
            });
            break;
        }
        case 'exposureSurge': {
            announce(ctx, event, []);
            const amount = event.amount ?? 12;
            getAlive(ctx.state).forEach(t => {
                const zone = getZone(ctx.state.arena, t.zone);
                const sheltered = (zone ? zoneFeatures(zone).shelterQuality : 0) ?? 0;
                const taken = Math.round(amount * (1 - sheltered * ARENA_EVENTS.surgeShelterRelief));
                if (taken <= 0) return;
                t.vitals.fatigue = Math.min(100, t.vitals.fatigue + ARENA_EVENTS.surgeFatigue);
                applyDamage(ctx, t, taken, { cause: `Caught in ${event.name.toLowerCase()}`, kind: 'gamemaker' });
                clampTribute(t);
                checkDeath(ctx, t, `Caught in ${event.name.toLowerCase()}`);
            });
            break;
        }
        case 'earlyCollapse': {
            const collapsed = ctx.state.collapsedZones ?? (ctx.state.collapsedZones = []);
            // Never take the Cornucopia and never take the last two sectors.
            const takeable = zones.filter(n => !/cornucopia/i.test(n));
            const taking = rng.shuffle(takeable).slice(0, Math.min(event.amount ?? 3, Math.max(0, zones.length - 3)));
            announce(ctx, event, taking);
            taking.forEach(n => { if (!collapsed.includes(n)) collapsed.push(n); });
            break;
        }
        case 'revealAll': {
            announce(ctx, event, []);
            const living = getAlive(ctx.state);
            living.forEach(watcher => {
                living.forEach(seen => {
                    if (seen.id === watcher.id) return;
                    const rivals = living.filter(o => o.zone === seen.zone && o.id !== watcher.id).length;
                    noteSighting(ctx.state, watcher, seen.zone, rivals, 0);
                });
            });
            // Say it in the log in the plainest possible terms: this is a
            // position report, and the reader should be able to read it as one.
            const byZone = new Map<string, Tribute[]>();
            living.forEach(t => {
                if (!byZone.has(t.zone)) byZone.set(t.zone, []);
                byZone.get(t.zone)!.push(t);
            });
            [...byZone.entries()].forEach(([zone, people]) => {
                ctx.logEvent(
                    `Position report — ${zone}: ${people.map(p => `${p.name} (D${p.district})`).join(', ')}.`,
                    people.map(p => p.id),
                    { zone, category: 'arena' },
                );
            });
            break;
        }
        case 'convergence':
            convergeNow(ctx);
            break;
    }
}

/**
 * §11 (requests): the convergence test, run every cycle.
 *
 * Fires once, when the field is in the closing band and the run is past its
 * opening. After it fires the arena is closed to the convergence zone and its
 * immediate neighbours, the border takes an extra sector per cycle, and
 * `chooseObjective` drives everyone still alive toward the middle of it (see
 * `state.convergenceZone`).
 */
export function maybeConverge(ctx: SimContext) {
    if (ctx.state.convergenceDay !== undefined) return;
    const alive = getAlive(ctx.state);
    if (alive.length > ESCALATION.convergeAtOrBelow) return;
    if (alive.length < 2) return;
    if (ctx.state.day < ESCALATION.convergeEarliestDay) return;
    convergeNow(ctx);
}

function convergeNow(ctx: SimContext) {
    if (ctx.state.convergenceDay !== undefined) return;
    const alive = getAlive(ctx.state);
    const open = liveZones(ctx);
    if (open.length === 0) return;

    // The Cornucopia when it is still standing — it is the one sector every
    // tribute in the arena can find without being told where it is.
    const horn = open.find(n => /cornucopia/i.test(n)) ?? open[0];
    ctx.state.convergenceDay = ctx.state.day;
    ctx.state.convergenceZone = horn;

    // Everything except the convergence zone and what touches it goes.
    const zone = getZone(ctx.state.arena, horn);
    const keep = new Set<string>([horn, ...(zone?.adjacent ?? [])]);
    const collapsed = ctx.state.collapsedZones ?? (ctx.state.collapsedZones = []);
    open.forEach(n => { if (!keep.has(n) && !collapsed.includes(n)) collapsed.push(n); });

    announce(ctx, CONVERGENCE, [horn]);
    ctx.logEvent(
        `${alive.length} tributes are still alive: ${alive.map(t => `${t.name} (D${t.district})`).join(', ')}. `
        + `All of them are being driven to ${horn}.`,
        alive.map(t => t.id),
        { important: true, category: 'gamemaker' },
    );
}

/**
 * The convergence tightening, one cycle at a time. Called from the day/night
 * loop after the ordinary border collapse has run.
 */
export function tickConvergence(ctx: SimContext) {
    if (ctx.state.convergenceDay === undefined) return;
    const horn = ctx.state.convergenceZone;
    if (!horn) return;
    const collapsed = ctx.state.collapsedZones ?? (ctx.state.collapsedZones = []);
    const open = liveZones(ctx);
    // Down to the convergence zone itself, one neighbour per cycle. The zone
    // the field is being driven into is never taken: the Gamemakers want the
    // fight, not an empty arena.
    const droppable = open.filter(n => n !== horn);
    droppable.slice(0, ESCALATION.convergeExtraZonesPerCycle).forEach(n => {
        if (!collapsed.includes(n)) {
            collapsed.push(n);
            ctx.logEvent(`${n} is closed. The remaining ground is ${open.filter(o => o !== n).join(', ')}.`,
                [], { important: true, category: 'gamemaker' });
        }
    });
}
