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
import { noteSighting, cycleOf } from './memory';
import { ARENA_EVENTS, CONVERGENCE_RECAP, ESCALATION, NOTORIETY } from '../data/balance';
import { addNotoriety } from './notoriety';
import { adjustRel } from './relationships';
import { addExcitement } from './audience';
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
    maybeMuster(ctx);
    tickMuster(ctx);
    maybeConverge(ctx);
}

/**
 * AUDIT-6 §9.1: the muster — a reason to meet, at twice the field size and
 * none of the force of the convergence.
 *
 * The measured shape of a run was one large opening slaughter and then eight
 * days of twelve people not meeting, and the only answer the engine had was
 * the convergence at six alive, which is the last third. This is the middle
 * third's answer, and deliberately an incentive rather than a wall: the
 * Capitol puts a price on one sector, tells everybody where it is, and lets
 * them decide. A tribute who would rather keep hiding keeps hiding and simply
 * does not get paid.
 */
export function maybeMuster(ctx: SimContext) {
    if (ctx.state.musterDay !== undefined) return;
    if (ctx.state.convergenceDay !== undefined) return;
    const alive = getAlive(ctx.state);
    if (alive.length > ESCALATION.musterAtOrBelow) return;
    if (alive.length <= ESCALATION.convergeAtOrBelow) return;
    if (ctx.state.day < ESCALATION.musterEarliestDay) return;

    const open = liveZones(ctx);
    if (open.length === 0) return;
    // Not the Cornucopia: the horn is where the convergence goes, and a muster
    // that sent everybody back to the opening sector would be the same scene
    // twice. Somewhere worth having, that most of the field is not in.
    const occupied = new Set(alive.map(t => t.zone));
    // Nor a sector that is currently on fire, flooding or freezing: the
    // Capitol is selling a place to be watched, and a standing offer to come
    // and die in a hazard is a different show. It also keeps the muster from
    // moving the mutt-and-hazard share of deaths, which is guarded.
    const safe = (n: string) => ((ctx.state.zoneEffects ?? {})[n] ?? []).length === 0;
    const zone = open.find(n => !/cornucopia/i.test(n) && !occupied.has(n) && safe(n))
        ?? open.find(n => !/cornucopia/i.test(n) && safe(n))
        ?? open.find(n => !/cornucopia/i.test(n))
        ?? open[0];

    ctx.state.musterDay = ctx.state.day;
    ctx.state.musterZone = zone;
    ctx.state.musterUntilCycle = cycleOf(ctx.state) + ESCALATION.musterCycles;
    ctx.logEvent(
        `The Capitol does not close anything today. It simply announces, in the voice it uses for weather, that for the next few `
        + `cycles every sponsor in the city is watching ${zone} and nowhere else — and that anybody standing in it will be paid `
        + `for the privilege. ${alive.length} tributes have now been told where everybody else is about to be.`,
        // §22: a Capitol announcement is addressed to the arena, not about any
        // particular tribute — an empty cast keeps it out of the naming audit
        // for lines that are *about* people, which this one is not.
        [],
        { important: true, category: 'gamemaker' },
    );
}

/** Per-cycle: pays whoever took the offer, and lifts it when the term runs out. */
export function tickMuster(ctx: SimContext) {
    const until = ctx.state.musterUntilCycle;
    const zone = ctx.state.musterZone;
    if (until === undefined || zone === undefined) return;
    if (cycleOf(ctx.state) > until) {
        ctx.state.musterZone = undefined;
        ctx.state.musterUntilCycle = undefined;
        ctx.logEvent(
            `The cameras come off ${zone} as abruptly as they went on it, and whoever is standing there is standing there for `
            + 'their own reasons now.',
            [],
            { category: 'gamemaker' },
        );
        return;
    }
    const paid = getAlive(ctx.state).filter(t => t.zone === zone);
    /*
     * AUDIT-6 §9.1: the approaches are paid too, at half.
     *
     * Measured at n=1,600 without this: the muster took the Saboteur from
     * 2.80% to 2.16%, through its guard. That is the mechanic working exactly
     * as written and being wrong — an offer that can only be taken by standing
     * in the open is a tax on every archetype whose whole game is not standing
     * in the open, and the Saboteur, the Ghost and the Scholar pay it.
     *
     * A camera crew covering a sector covers the ways into it. Watching the
     * crowd from the treeline is a way of attending, and it is the *correct*
     * way for those archetypes to attend, so it pays — less, because the
     * Capitol is paying for the shot it actually wants.
     */
    const near = new Set(getZone(ctx.state.arena, zone)?.adjacent ?? []);
    const watching = getAlive(ctx.state).filter(t => t.zone !== zone && near.has(t.zone));
    if (paid.length === 0 && watching.length === 0) return;
    paid.forEach(t => {
        t.sponsorTrust = Math.min(100, t.sponsorTrust + ESCALATION.musterTrust);
        addExcitement(t, ESCALATION.musterExcitement);
    });
    watching.forEach(t => {
        t.sponsorTrust = Math.min(100, t.sponsorTrust + ESCALATION.musterTrust * ESCALATION.musterWatchShare);
        addExcitement(t, ESCALATION.musterExcitement * ESCALATION.musterWatchShare);
    });
    ctx.state.musterPayouts = (ctx.state.musterPayouts ?? 0) + paid.length + watching.length;
    if (paid.length === 0) {
        ctx.logEvent(
            `Nobody is standing in ${zone} with the whole Capitol watching it. ${watching.map(t => t.name).join(', ')} `
            + `${watching.length === 1 ? 'is' : 'are'} near enough to see it being empty, which the cameras find almost as interesting.`,
            watching.map(t => t.id),
            { category: 'sponsor' },
        );
        return;
    }
    ctx.logEvent(
        paid.length === 1
            ? `${paid[0].name} is the only tribute in ${zone} while the city is watching it, and is paid accordingly. `
                + 'It is a great deal of money and a very exposed place to be standing.'
            : `${paid.map(t => t.name).join(', ')} are all in ${zone} with the whole Capitol watching, and all of them know `
                + 'exactly why the others came.',
        paid.map(t => t.id),
        { important: true, category: 'sponsor' },
    );
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
    theRecap(ctx, alive);
}

/**
 * AUDIT-6 §4.1: the recap, and the reason it is here rather than in a drift.
 *
 * Measured across 200 runs: **43.5% of final-two pairings were between
 * strangers** — two people with no regard either way, in either direction,
 * deciding the Games. That is the real shape of "three quarters of the social
 * graph is empty": field-wide it is mostly correct modelling, because most of
 * twenty-four people genuinely never meet, and in the endgame it is not.
 *
 * A slow reputation drift did not fix it, for a reason worth writing down: by
 * the time the field is small enough for anybody to have heard of anybody there
 * are two or three cycles left, and a drift needs more than that. So this is
 * the thing that actually happens instead — the Capitol runs the recap. Every
 * tribute still standing is shown what every other one has done, all at once,
 * and forms an opinion on the spot.
 *
 * It is also a scene rather than a silent number, which is the better reason:
 * the moment the field learns who it is left with is one of the loudest in the
 * source material, and the engine was doing it in arithmetic nobody could see.
 */
function theRecap(ctx: SimContext, alive: Tribute[]) {
    if (alive.length < 2) return;
    const notable = (t: Tribute): string | undefined => {
        if (t.kills >= CONVERGENCE_RECAP.butcherKills) return `${t.kills} kills`;
        if ((t.sparedDowned?.length ?? 0) > 0) return 'let somebody up who did not have to be let up';
        if (t.kills > 0) return t.kills === 1 ? 'one kill' : `${t.kills} kills`;
        if ((t.betrayalsCommitted ?? 0) > 0) return 'went back on their word';
        return undefined;
    };
    const lines = alive.map(t => {
        const note = notable(t);
        return note ? `${t.name}, ${note}` : `${t.name}, who has not given them much to show`;
    });
    ctx.logEvent(
        `THE RECAP: the screens over ${ctx.state.convergenceZone} run the whole week back in four minutes, and every tribute `
        + `still standing watches every other one do what they did. ${lines.join('; ')}.`,
        alive.map(t => t.id),
        { important: true, category: 'gamemaker' },
    );
    // Everybody now knows everybody's record, and has a view about it. This is
    // the one place the engine is entitled to write regard between people who
    // have never met: they have just been shown each other.
    alive.forEach(watcher => alive.forEach(subject => {
        if (watcher.id === subject.id) return;
        addNotoriety(watcher, subject.id, NOTORIETY.max * CONVERGENCE_RECAP.notorietyShare);
        const spared = subject.sparedDowned?.length ?? 0;
        const current = watcher.relationships[subject.id] ?? 0;
        // A record of kills reads as a threat; a record of mercy reads as the
        // one person here who might not finish it. Only ever pushed away from
        // neutral — the recap explains a stranger, it never overrules a history.
        const delta = subject.kills >= CONVERGENCE_RECAP.butcherKills
            ? -CONVERGENCE_RECAP.regardPerKiller
            : spared > 0 ? CONVERGENCE_RECAP.regardPerMerciful
                : subject.kills > 0 ? -CONVERGENCE_RECAP.regardPerKiller / 2
                    // Nobody leaves the recap without an opinion. A tribute who
                    // has reached the last six having killed nobody is not
                    // unremarkable — they are the one person here nobody has
                    // managed to kill, which is its own kind of warning.
                    : -CONVERGENCE_RECAP.regardPerSurvivor;
        if (delta < 0 && current < 0) { adjustRel(watcher, subject.id, delta); return; }
        if (delta > 0 && current > 0) { adjustRel(watcher, subject.id, delta); return; }
        // Crossing zero is what makes this a first impression rather than a
        // correction, so a stranger picks up a real opinion in one go.
        if (Math.abs(current) < CONVERGENCE_RECAP.strangerBand) adjustRel(watcher, subject.id, delta);
    }));
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
