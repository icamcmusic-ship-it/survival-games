import { SimContext, getAlive } from './context';
import { ExposureProfile, applyExposure } from './exposure';
import { getZone } from './map';
import { GAMEMAKER, GAMEMAKER_ACTIONS, OBJECTIVES } from '../data/balance';
import { eligibleMutts, engageMutt, rosterFor } from './mutts';
import { ZoneEffectKind } from '../models/types';
import { dropSupplies, severRandomEdge, startZoneEffect } from './zoneEffects';
import { cycleOf, noteSighting } from './memory';
import { addExcitement } from './audience';
import { clampTribute } from './vitals';
import { GAMEMAKER_TEXTS } from '../data/flavorText';

/**
 * Gamemaker weather, expressed as exposure profiles.
 *
 * These used to be a second, independent damage-over-time implementation with
 * its own frostbite roll, its own damage numbers and its own cause-of-death
 * strings — so a manual cold snap on the Frozen Wasteland stacked two different
 * freezing systems on the same tribute. They are the same kind of thing the
 * arena's own climate is, so they are now the same kind of object, run through
 * `applyExposure`. `intensity` is what makes a Gamemaker storm worse than
 * weather: the same profile shape, turned up.
 */
const WEATHER_EFFECTS: ExposureProfile[] = [
    {
        name: 'a torrential downpour',
        cause: 'Drowned in the Gamemakers\' downpour',
        fatigue: 15,
        sanity: 5,
        quench: 30,
        intensity: GAMEMAKER.weatherIntensity,
    },
    {
        name: 'a scorching heatwave',
        cause: 'Died of heatstroke in the Gamemakers\' heatwave',
        fatigue: 20,
        sanity: 10,
        thirst: 20,
        burn: 0.1,
        intensity: GAMEMAKER.weatherIntensity,
    },
    {
        name: 'a freezing cold snap',
        cause: 'Froze to death in the Gamemakers\' cold snap',
        fatigue: 25,
        sanity: 10,
        frostbite: 0.15,
        intensity: GAMEMAKER.weatherIntensity,
        onFrostbite: t => `${t.name} is caught in the open and suffers frostbite.`,
    },
    {
        name: 'a choking toxic fog',
        cause: 'Suffocated in the Gamemakers\' toxic fog',
        fatigue: 10,
        sanity: 20,
        poison: 0.15,
        intensity: GAMEMAKER.weatherIntensity,
        onPoison: t => `${t.name} inhales the toxic fog and is poisoned.`,
    },
    {
        name: 'a wall of blowing grit',
        cause: 'Flayed by the Gamemakers\' grit storm',
        damage: 6,
        fatigue: 18,
        sanity: 8,
        thirst: 15,
        infection: 0.12,
        intensity: GAMEMAKER.weatherIntensity,
    },
    {
        name: 'a sheet of freezing rain',
        cause: 'Died of exposure in the Gamemakers\' freezing rain',
        damage: 4,
        fatigue: 22,
        sanity: 12,
        quench: 20,
        frostbite: 0.1,
        intensity: GAMEMAKER.weatherIntensity,
        onFrostbite: t => `${t.name} cannot get warm again after the freezing rain finds them.`,
    },
    {
        name: 'a dead, airless heat',
        cause: 'Died of heatstroke in the Gamemakers\' dead air',
        damage: 5,
        fatigue: 25,
        sanity: 15,
        thirst: 30,
        intensity: GAMEMAKER.weatherIntensity,
    },
    {
        name: 'a rain of stinging ash',
        cause: 'Choked on the Gamemakers\' ashfall',
        damage: 7,
        fatigue: 12,
        sanity: 10,
        burn: 0.08,
        infection: 0.08,
        intensity: GAMEMAKER.weatherIntensity,
        onBurn: t => `${t.name} is pocked with burns where the ash settled on bare skin.`,
    },
];

/**
 * S-5: the Gamemaker's toolkit.
 *
 * Six interventions covered fire, water, fog, a cut route, a supply drop and a
 * bounty — every one of them a way to hurt somebody, and none of them the
 * things a real Head Gamemaker spends most of their day doing: pointing the
 * cameras, talking to the arena, and opening a door.
 */
export type GamemakerEventType =
    | 'mutt' | 'weather' | 'feast'
    | 'burn' | 'flood' | 'fog' | 'sever' | 'bounty' | 'drop'
    | 'spotlight' | 'announce' | 'reopen';

export function triggerGamemakerEvent(ctx: SimContext, type: GamemakerEventType, targetId?: string) {
    if (!ctx.state.gamemakerMode) return;

    if (type === 'mutt') {
        // Route through the full per-arena mutt roster (engine/mutts.ts) rather
        // than the vestigial Arena.mutts display strings — a Gamemaker-released
        // mutt gets the same pack size, speed-based evasion, terrain gating and
        // persistent tracking as one the day/night cycle rolls up naturally.
        // Dusk counts as night for the mutts that only come out in it.
        const time = ctx.state.timeOfDay === 'day' ? 'day' : 'night';
        const muttFor = (t: { zone: string }) => {
            const eligible = eligibleMutts(ctx, t as never, time);
            const pool = eligible.length > 0 ? eligible : rosterFor(ctx);
            return pool.length > 0 ? ctx.rng.pick(pool) : undefined;
        };

        if (targetId) {
            const t = ctx.state.tributes.find(tr => tr.id === targetId);
            if (t && t.status === 'alive') {
                const mutt = muttFor(t);
                if (mutt) {
                    ctx.logEvent(`GAMEMAKER: A pack of ${mutt.name} is dropped directly onto ${t.name} in ${t.zone}.`, [t.id], { important: true, category: 'gamemaker' });
                    engageMutt(ctx, t, mutt);
                }
            }
        } else {
            const announceMutt = rosterFor(ctx).length > 0 ? ctx.rng.pick(rosterFor(ctx)).name : 'mutts';
            ctx.logEvent(`GAMEMAKER: ${announceMutt} are released into the arena!`, [], { important: true, category: 'gamemaker' });
            getAlive(ctx.state).forEach(t => {
                // Tributes in dangerous zones are easier prey for released mutts
                const zone = getZone(ctx.state.arena, t.zone);
                const hitChance = GAMEMAKER.muttSweepBaseChance + (zone ? zone.danger * GAMEMAKER.muttSweepDangerWeight : 0.1);
                if (!ctx.rng.chance(hitChance)) return;
                const mutt = muttFor(t);
                if (mutt) engageMutt(ctx, t, mutt);
            });
        }
    } else if (type === 'weather') {
        const weather = ctx.rng.pick(WEATHER_EFFECTS);
        ctx.logEvent(
            `GAMEMAKER: The weather shifts drastically. ${weather.name.charAt(0).toUpperCase() + weather.name.slice(1)} sweeps the arena!`,
            [],
            { important: true, category: 'gamemaker' }
        );
        getAlive(ctx.state).forEach(t => {
            // One exposure system, shared with the arena's own climate.
            applyExposure(ctx, t, weather);
        });
    } else if (type === 'feast') {
        if (!ctx.state.config.enableFeast) {
            ctx.logEvent('GAMEMAKER: A feast is requested, but feasts are disabled for these Games.', [], { category: 'gamemaker' });
            return;
        }
        // A feast during the bloodbath would silently swallow the bloodbath phase.
        if (ctx.state.phase !== 'day' && ctx.state.phase !== 'night') {
            ctx.logEvent('GAMEMAKER: The feast horn can only sound once the Games proper are under way.', [], { category: 'gamemaker' });
            return;
        }
        // One feast per day, however many times the horn is pressed. Resolving a
        // feast returns the run to the same day it started on, so an unguarded
        // trigger lets a caller keyed on (day, phase) call feasts forever — and
        // a tribute who declines every one of them never dies, so the Games
        // never end.
        if (ctx.state.feastDay === ctx.state.day || ctx.state.lastFeastDay === ctx.state.day) {
            ctx.logEvent('GAMEMAKER: The tributes have already been called to the Cornucopia today. The table stays empty.', [], { category: 'gamemaker' });
            return;
        }
        ctx.logEvent(`GAMEMAKER: A feast is announced at the Cornucopia!`, [], { important: true, category: 'gamemaker' });
        ctx.state.feastDay = ctx.state.day;
        ctx.state.phase = 'feast';
    } else if (type === 'burn' || type === 'flood' || type === 'fog') {
        // §6.4: the engine already had ZoneEffectKind, severed edges, bounties
        // and supply drops — the player-facing control surface just never
        // exposed them. For zone actions `targetId` is a zone name.
        const kind: ZoneEffectKind = type === 'burn' ? 'burning' : type === 'flood' ? 'flooded' : 'fogbound';
        const zone = pickTargetZone(ctx, targetId);
        if (!zone) return;
        ctx.logEvent(`GAMEMAKER: The arena is turned against ${zone}.`, [], { important: true, zone, category: 'gamemaker' });
        startZoneEffect(ctx, zone, kind);
    } else if (type === 'sever') {
        const zone = pickTargetZone(ctx, targetId);
        if (!zone) return;
        const cut = severRandomEdge(ctx, zone);
        ctx.logEvent(
            cut
                ? `GAMEMAKER: The route between ${zone} and ${cut} is destroyed. The map every tribute carries in their head is now wrong.`
                : `GAMEMAKER: The engineers report no route out of ${zone} left to cut.`,
            [],
            { important: !!cut, zone, category: 'gamemaker' }
        );
    } else if (type === 'bounty') {
        if (ctx.state.bountyTargetId) {
            ctx.logEvent('GAMEMAKER: A bounty already stands. The Capitol only points at one tribute at a time.', [], { category: 'gamemaker' });
            return;
        }
        const alive = getAlive(ctx.state);
        const target = targetId
            ? alive.find(t => t.id === targetId)
            : [...alive].sort((a, b) => a.excitementRating - b.excitementRating)[0];
        if (!target) return;
        ctx.state.bountyTargetId = target.id;
        ctx.logEvent(
            `GAMEMAKER: A bounty is placed on ${target.name} of District ${target.district}. Everyone left in the arena now has one very good reason to change direction.`,
            [target.id],
            { important: true, category: 'gamemaker' }
        );
        alive.forEach(t => {
            if (t.id === target.id) return;
            if (t.allianceId !== undefined && t.allianceId === target.allianceId) return;
            // The Capitol broadcasts where they are — a bounty is public.
            noteSighting(ctx.state, t, target.zone, 1, 0);
            t.objective = { kind: 'hunt', targetId: target.id, expires: cycleOf(ctx.state) + OBJECTIVES.huntCycles };
        });
    } else if (type === 'drop') {
        dropSupplies(ctx);
    } else if (type === 'spotlight') {
        spotlightTribute(ctx, targetId);
    } else if (type === 'announce') {
        announceFromTheSky(ctx);
    } else if (type === 'reopen') {
        reopenRoute(ctx, targetId);
    }
}

/**
 * S-5: the camera, which is the Gamemakers' most-used instrument and was not
 * in the toolkit at all. Excitement is the currency the sponsor stream and
 * the boredom clock both read, so pointing it at somebody is a real
 * intervention — it buys that tribute parachutes without touching the arena.
 */
function spotlightTribute(ctx: SimContext, targetId?: string) {
    const alive = getAlive(ctx.state);
    const target = targetId
        ? alive.find(t => t.id === targetId)
        // Nobody named: the story the audience is already leaning toward.
        : [...alive].sort((a, b) => b.excitementRating - a.excitementRating)[0];
    if (!target) return;
    addExcitement(target, GAMEMAKER_ACTIONS.spotlightExcitement);
    target.sponsorTrust = Math.min(100, target.sponsorTrust + GAMEMAKER_ACTIONS.spotlightTrust);
    clampTribute(target);
    ctx.logEvent(
        `GAMEMAKER: every feed in the Capitol cuts to ${target.name} of District ${target.district} and stays there. `
        + `Whatever they do in the next hour, the whole country is watching them do it.`,
        [target.id],
        { important: true, category: 'gamemaker' }
    );
}

/**
 * S-5: the voice from the sky. In canon it is how the Gamemakers move the
 * board without touching it — the feast, the rule change, the reminder that
 * somebody is watching. Here it resets the boredom clock and puts the whole
 * field on notice.
 */
function announceFromTheSky(ctx: SimContext) {
    const alive = getAlive(ctx.state);
    ctx.state.audienceInterest = Math.min(100, (ctx.state.audienceInterest ?? 50) + GAMEMAKER_ACTIONS.announceInterest);
    alive.forEach(t => {
        t.vitals.sanity -= GAMEMAKER_ACTIONS.announceSanity;
        clampTribute(t);
    });
    ctx.logEvent(
        ctx.pickText(GAMEMAKER_TEXTS.announcement),
        alive.map(t => t.id),
        { important: true, category: 'gamemaker' }
    );
}

/**
 * S-5: opening a door rather than closing one. `sever` could cut a route and
 * nothing could ever restore one, so the Gamemakers could only ever make the
 * arena smaller — which is half of what the job actually is.
 */
function reopenRoute(ctx: SimContext, targetId?: string) {
    const severed = ctx.state.severedEdges ?? [];
    if (severed.length === 0) {
        ctx.logEvent('GAMEMAKER: there is nothing closed to open. Every route in the arena is already standing.', [], { category: 'gamemaker' });
        return;
    }
    // A named zone reopens one of its own edges when it has one.
    const preferred = targetId ? severed.find(key => key.split('|').includes(targetId)) : undefined;
    const key = preferred ?? ctx.rng.pick(severed);
    ctx.state.severedEdges = severed.filter(e => e !== key);
    const [a, b] = key.split('|');
    ctx.logEvent(
        `GAMEMAKER: the route between ${a} and ${b} opens again — cleared, rebuilt, or simply un-collapsed, and nobody is explaining which. `
        + `Anyone who had written that direction off has a decision to make.`,
        [],
        { important: true, zone: a, category: 'gamemaker' }
    );
}

/** Resolves a zone action's target: the named zone if it stands, else a random standing zone. */
function pickTargetZone(ctx: SimContext, targetId?: string): string | undefined {
    const collapsed = new Set(ctx.state.collapsedZones ?? []);
    const standing = ctx.state.arena.zones.filter(z => !collapsed.has(z.name));
    if (targetId && standing.some(z => z.name === targetId)) return targetId;
    return standing.length > 0 ? ctx.rng.pick(standing).name : undefined;
}
