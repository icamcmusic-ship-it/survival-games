import {
    ArenaDepthState, Item, ObjectiveReason, Terrain, Tribute, TributePlan, WeatherKind, Zone, ZoneEffectKind, ZoneScarKind,
} from '../models/types';
import { ARENA_DEPTH, OBJECTIVES, QUALITY_BIAS } from '../data/balance';
import { ARCHETYPES } from '../data/archetypes';
import { IMPROVISED_ITEMS, ITEMS } from '../data/constants';
import { RNG } from '../utils/rng';
import { SimContext, getAlive } from './context';
import { edgeKey, getZone, zoneFeatures } from './map';
import { addZoneThreat, cycleOf, rivalRecord } from './memory';
import { endZoneEffect, hasEffect, startZoneEffect } from './zoneEffects';
import { giveItem, inventoryValue, itemPhrase, mintItem } from './items';
import { applyDamage, checkDeath } from './combat';
import { injure } from './wounds';
import { clampTribute } from './vitals';
import { profOf } from './proficiency';
import { canAfford, spend } from './actionBudget';
import { allied } from './alliance';
import { currentSightline, fallenZones, setMark, getMark, markActCut, releaseActCut, unstrandZones, isEnclosedIgnitionZone } from './arenaRules';
import { ACTION_BUDGET, AUDIT12_ARENA } from '../data/balance';
import { buildCollapseOrder } from './phases/dayNight';

/**
 * AUDIT-11 §5 "Add depth", §7 "Shared upgrades", §13 "crafting".
 *
 * One module for the standing arena mechanics that every map shares, written
 * the way `arenaRules.ts` is written: inert readers returning the neutral
 * value when nothing is in force, and a single per-cycle tick that owns the
 * state. Everything lives on `state.arenaDepth`, every field optional, so a
 * save from before this module loads unchanged and simply starts with clear
 * skies. Every roll draws from its own seeded stream
 * (`${seed}-depth-<what>-<cycle>`), never from `ctx.rng`, so turning any one
 * part off does not reshuffle the rest of the run.
 *
 *   Weather layer   fog / heat / storm / rain, arena-wide, telegraphed one
 *                   cycle ahead. Perceptive tributes (Reads The Sky,
 *                   Weather-Nose, Watchful, the Forecaster, anyone sharp
 *                   enough) brace: they mark exposed ground as dangerous, so
 *                   the movement layer walks them off it, and they take the
 *                   weather at half weight. Moves stealth, noise, forage and
 *                   ranged combat; Frost-Born, Heat-Bred and Night-Sighted
 *                   each have a stake in it.
 *   Zone scars      burnt / flooded / collapsed / trampled, recorded from what
 *                   actually happened to the ground and persisting after it.
 *                   They cut yield and regrowth, move cover, and gate what can
 *                   happen there next (burnt or flooded ground does not burn).
 *   Hidden cache    a second, unmarked supply cache, found by Cartographers
 *                   and Trackers far more often than by anybody else.
 *   Arena acts      three-act transformations for arenas that had none,
 *                   keyed to day and alive-count, reusing `arenaRules`.
 *   Crafted kit     snare kits and bivouac sheets that enter the inventory and
 *                   wear out; a weapon that breaks mid-fight can hurt its owner.
 *   Plans           two- and three-step errands that survive interruption.
 *   Deception       a fake camp that pulls hunters the wrong way; a feigned
 *                   wound that baits them in.
 *   Risk curve      late in a run, hoarders turn predator and pacifists can break.
 */

function depth(ctx: SimContext | { state: SimContext['state'] }): ArenaDepthState {
    const state = ctx.state;
    if (!state.arenaDepth) state.arenaDepth = {};
    return state.arenaDepth;
}

function bump(ctx: SimContext, key: string, by = 1) {
    const d = depth(ctx);
    d.stats = { ...(d.stats ?? {}), [key]: (d.stats?.[key] ?? 0) + by };
}

function streamOf(ctx: SimContext, what: string): RNG {
    return new RNG(`${ctx.state.seed}-depth-${what}-${cycleOf(ctx.state)}`);
}

function has(t: Tribute, trait: string): boolean {
    return t.traits.includes(trait);
}

// =====================================================================================
// Weather layer
// =====================================================================================

const WEATHER_KINDS: WeatherKind[] = ['fog', 'heat', 'storm', 'rain'];

/** Which terrains pull the arena toward which weather. */
const TERRAIN_WEATHER: Partial<Record<Terrain, WeatherKind>> = {
    desert: 'heat', open: 'heat',
    water: 'rain', wetland: 'fog',
    ice: 'storm', highland: 'storm',
    forest: 'rain', ruins: 'fog',
};

const TELEGRAPH: Record<WeatherKind, string> = {
    fog: 'The air over the arena has gone still and heavy, and the low ground is starting to smoke with it. There will be fog by the next light.',
    heat: 'The wind has dropped entirely and the ground is holding the heat long after it should have let it go. Tomorrow is going to be a furnace.',
    storm: 'The sky on the arena\'s edge has gone the colour of a bruise, and the birds have stopped. Something is coming in hard.',
    rain: 'There is a smell of rain on the wind, and the clouds are banking up over the rim. It will be wet before long.',
};

const ARRIVAL: Record<WeatherKind, string> = {
    fog: 'Fog rolls in over the whole arena. Nobody can see more than a few strides, and every sound seems to come from everywhere.',
    heat: 'The heat arrives. By mid-morning nothing in the arena moves that does not have to, and the water goes twice as fast.',
    storm: 'The storm breaks over the arena: wind that takes the breath away, rain sideways, thunder close enough to feel. Anybody out in the open is in trouble.',
    rain: 'It rains, steadily and everywhere. Tracks fill with water, sound drowns, and for once nobody is thirsty.',
};

const CLEARS: Record<WeatherKind, string> = {
    fog: 'The fog thins and lifts. Everybody who was hiding in it is suddenly a lot easier to see.',
    heat: 'The heat breaks at last. The arena exhales.',
    storm: 'The storm blows itself out. What is left is wet, cold and quieter than before.',
    rain: 'The rain stops. Every print left from here on will show.',
};

/** The weather in force this cycle, if any. */
export function currentWeather(state: SimContext['state']): WeatherKind | undefined {
    const w = state.arenaDepth?.weather;
    if (!w || (state.cycle ?? 0) > w.untilCycle) return undefined;
    // Fog does not stack on an arena-wide whiteout or blackout: nobody can
    // see a stride already, and the sightline is what is hiding them.
    if (w.kind === 'fog' && sightlineHides(state)) return undefined;
    return w.kind;
}

function sightlineHides(state: SimContext['state']): boolean {
    const mode = currentSightline(state);
    return mode === 'whiteout' || mode === 'blackout';
}

/**
 * Arenas under a roof: the universal weather layer never rains or storms in
 * them (fog and heat are still air, and can happen indoors). The Glasshouse
 * counts only while every pane is whole — once a wing has given, the sky is in.
 */
const INDOOR_ARENAS = new Set([
    'gallery', 'wardblock', 'malthouse', 'undercroft', 'glasshouse', 'kelvin', 'vault',
    'warren', 'nooneplace', 'magmatube', 'karst', 'ashgrove', 'abattoir',
]);

export function arenaIsIndoor(state: SimContext['state']): boolean {
    const id = state.arena.id;
    if (!INDOOR_ARENAS.has(id)) return false;
    if (id === 'glasshouse') return Number(getMark(state, 'glass:given') ?? 0) === 0;
    return true;
}

/** Whether this tribute reads the sky a cycle out. */
export function readsWeather(t: Tribute): boolean {
    return has(t, 'Reads The Sky') || has(t, 'Weather-Nose') || has(t, 'Watchful')
        || t.archetype === 'forecaster'
        || t.attributes.intelligence >= ARENA_DEPTH.telegraphIntelligence;
}

function braced(state: SimContext['state'], t: Tribute): boolean {
    return state.arenaDepth?.weather?.braced?.includes(t.id) ?? false;
}

/** Concealment shift a hider gets from the weather, as seen by this seeker. */
export function weatherConcealment(state: SimContext['state'], seeker: Tribute | undefined): number {
    const kind = currentWeather(state);
    if (!kind) return 0;
    let shift: number = ARENA_DEPTH.concealment[kind];
    if (kind === 'fog' && seeker && (has(seeker, 'Night-Sighted') || has(seeker, 'Weather-Nose'))) {
        shift *= 1 - ARENA_DEPTH.fogSeerCancel;
    }
    return shift;
}

/** Multiplier on how far a crossing carries. */
export function weatherNoise(state: SimContext['state']): number {
    const kind = currentWeather(state);
    return kind ? ARENA_DEPTH.noise[kind] : 1;
}

/** Multiplier on forage yield. */
export function weatherForage(state: SimContext['state']): number {
    const kind = currentWeather(state);
    return kind ? ARENA_DEPTH.forage[kind] : 1;
}

/** Combat power a ranged or thrown weapon loses to the weather. */
export function weatherRangedPenalty(state: SimContext['state']): number {
    const kind = currentWeather(state);
    return kind ? ARENA_DEPTH.rangedPenalty[kind] : 0;
}

function pickWeather(ctx: SimContext, rng: RNG): WeatherKind {
    const zones = ctx.state.arena.zones;
    const weights: Record<WeatherKind, number> = { ...ARENA_DEPTH.weatherWeights };
    zones.forEach(z => {
        const pull = TERRAIN_WEATHER[z.terrain];
        if (pull) weights[pull] += ARENA_DEPTH.weatherTerrainPull / Math.max(1, zones.length);
    });
    const actPull = getMark(ctx.state, 'depthActWeather');
    if (typeof actPull === 'string' && (WEATHER_KINDS as string[]).includes(actPull)) {
        weights[actPull as WeatherKind] += ARENA_DEPTH.weatherActPull;
    }
    // Opt-outs zero a weight rather than skip the draw: one roll either way.
    if (arenaIsIndoor(ctx.state)) { weights.rain = 0; weights.storm = 0; }
    if (sightlineHides(ctx.state)) weights.fog = 0;
    const total = WEATHER_KINDS.reduce((a, k) => a + weights[k], 0);
    let roll = rng.nextFloat() * total;
    for (const k of WEATHER_KINDS) {
        if (weights[k] <= 0) continue;
        roll -= weights[k];
        if (roll <= 0) return k;
    }
    return WEATHER_KINDS.find(k => weights[k] > 0) ?? 'heat';
}

function shelterOf(state: SimContext['state'], zoneName: string): number {
    const z = getZone(state.arena, zoneName);
    return z ? zoneFeatures(z).shelterQuality ?? 0 : 0;
}

function hasBivouac(t: Tribute): Item | undefined {
    return t.inventory.find(i => i.id === 'bivouac' && (i.durability ?? 0) > 0);
}

function wearItem(t: Tribute, item: Item) {
    item.durability = Math.max(0, (item.durability ?? 0) - 1);
    if (item.durability <= 0) t.inventory = t.inventory.filter(i => i !== item);
}

function tickWeather(ctx: SimContext) {
    const state = ctx.state;
    const d = depth(ctx);
    const cycle = cycleOf(state);
    const rng = streamOf(ctx, 'weather');

    // Clear.
    if (d.weather && cycle > d.weather.untilCycle) {
        // AUDIT-12 E11: fog under a whiteout or blackout was never in force
        // (`currentWeather` hides it), so nobody sees it thin.
        if (!(d.weather.kind === 'fog' && sightlineHides(state))) ctx.logEvent(CLEARS[d.weather.kind], [], { category: 'arena' });
        d.weather = undefined;
    }

    // Arrive.
    if (d.incoming && cycle >= d.incoming.startCycle) {
        const kind = d.incoming.kind;
        // The roof went on (or the sightline went) between the telegraph and
        // the arrival: the front never reaches anybody.
        const blocked = ((kind === 'rain' || kind === 'storm') && arenaIsIndoor(state))
            || (kind === 'fog' && sightlineHides(state));
        if (blocked) d.incoming = undefined;
    }
    if (d.incoming && cycle >= d.incoming.startCycle) {
        const kind = d.incoming.kind;
        d.weather = {
            kind,
            untilCycle: cycle + rng.nextInt(ARENA_DEPTH.weatherMinCycles, ARENA_DEPTH.weatherMaxCycles) - 1,
            braced: d.incoming.braced,
        };
        d.incoming = undefined;
        bump(ctx, `weather:${kind}`);
        ctx.logEvent(ARRIVAL[kind], [], { important: true, category: 'arena' });
    }

    // Telegraph the next spell, one cycle out.
    if (!d.weather && !d.incoming && state.day >= ARENA_DEPTH.weatherEarliestDay
        && rng.chance(ARENA_DEPTH.weatherStartChance)) {
        const kind = pickWeather(ctx, rng);
        const alive = getAlive(state);
        const readers = alive.filter(readsWeather);
        d.incoming = { kind, startCycle: cycle + 1, braced: readers.map(t => t.id) };
        ctx.logEvent(TELEGRAPH[kind], [], { category: 'arena' });
        if (kind === 'storm' || kind === 'heat') {
            // The reaction: exposed ground becomes somewhere not to be, in the
            // one place a tribute's movement actually reads — their own map.
            const exposed = state.arena.zones.filter(z => (zoneFeatures(z).shelterQuality ?? 0) < ARENA_DEPTH.exposedShelterBelow);
            readers.forEach(t => exposed.forEach(z => addZoneThreat(state, t, z.name, ARENA_DEPTH.telegraphThreat)));
        }
        if (readers.length > 0) {
            bump(ctx, 'telegraphReads', readers.length);
            const named = readers.slice(0, 3).map(t => t.name).join(', ');
            ctx.logEvent(
                `${named} ${readers.length === 1 ? 'reads' : 'read'} the sky and ${readers.length === 1 ? 'starts' : 'start'} getting ready for it${kind === 'storm' || kind === 'heat' ? ', moving off open ground while there is still time' : ''}.`,
                readers.slice(0, 3).map(t => t.id),
                { category: 'survival' },
            );
        }
    }

    const kind = currentWeather(state);
    if (!kind) return;

    // Rain and storm drown fires.
    if (kind === 'rain' || kind === 'storm') {
        state.arena.zones.forEach(z => {
            if (hasEffect(state, z.name, 'burning') && rng.chance(ARENA_DEPTH.rainDousesFire)) {
                endZoneEffect(state, z.name, 'burning');
                bump(ctx, 'firesDoused');
                ctx.logEvent(`The ${kind} gets into ${z.name} and the fire there dies hissing.`, [], { zone: z.name, category: 'arena' });
            }
        });
    }

    getAlive(state).forEach(t => {
        const prepared = braced(state, t);
        const shelter = shelterOf(state, t.zone);
        const exposed = shelter < ARENA_DEPTH.exposedShelterBelow;
        const bivouac = hasBivouac(t);
        switch (kind) {
            case 'heat': {
                let load = 1;
                if (has(t, 'Heat-Bred')) load *= ARENA_DEPTH.heatBredScale;
                if (has(t, 'Frost-Born')) load *= ARENA_DEPTH.frostBornHeatScale;
                if (prepared) load *= ARENA_DEPTH.bracedScale;
                load *= 1 - shelter;
                t.vitals.thirst = Math.min(100, t.vitals.thirst + ARENA_DEPTH.heatThirst * load);
                t.vitals.fatigue = Math.min(100, t.vitals.fatigue + ARENA_DEPTH.heatFatigue * load);
                break;
            }
            case 'storm': {
                t.vitals.fatigue = Math.min(100, t.vitals.fatigue + ARENA_DEPTH.stormFatigue * (1 - shelter));
                t.vitals.sanity = Math.max(0, t.vitals.sanity - ARENA_DEPTH.stormSanity * (1 - shelter));
                if (!exposed) break;
                if (bivouac) { wearItem(t, bivouac); bump(ctx, 'bivouacUsed'); break; }
                let dmg = ARENA_DEPTH.stormDamage * (1 - shelter);
                if (has(t, 'Frost-Born')) dmg *= ARENA_DEPTH.frostBornStormScale;
                if (prepared) dmg *= ARENA_DEPTH.bracedScale;
                if (Math.round(dmg) > 0) {
                    applyDamage(ctx, t, Math.round(dmg), { cause: `Died of exposure in the storm at ${t.zone}`, kind: 'climate', code: 'exposure' });
                    bump(ctx, 'stormHits');
                    checkDeath(ctx, t, `Died of exposure in the storm at ${t.zone}`);
                }
                break;
            }
            case 'rain':
                t.vitals.thirst = Math.max(0, t.vitals.thirst - ARENA_DEPTH.rainQuench * (1 - shelter));
                break;
            case 'fog':
                if (!has(t, 'Night-Sighted') && !has(t, 'Weather-Nose')) {
                    t.vitals.sanity = Math.max(0, t.vitals.sanity - ARENA_DEPTH.fogSanity);
                }
                break;
        }
    });
}

// =====================================================================================
// Zone scars
// =====================================================================================

const SCAR_RANK: Record<ZoneScarKind, number> = { trampled: 1, flooded: 2, collapsed: 3, burnt: 4 };

export function scarOf(state: SimContext['state'], zoneName: string): ZoneScarKind | undefined {
    const s = state.arenaDepth?.scars?.[zoneName];
    if (!s || (state.cycle ?? 0) > s.untilCycle) return undefined;
    return s.kind;
}

/** Multiplier on this zone's forage yield from its scar. */
export function scarResourceScale(state: SimContext['state'], zoneName: string): number {
    const scar = scarOf(state, zoneName);
    return scar ? ARENA_DEPTH.scarResources[scar] : 1;
}

/** Multiplier on this zone's regrowth from its scar. */
export function scarRegrowthScale(state: SimContext['state'], zoneName: string): number {
    const scar = scarOf(state, zoneName);
    return scar ? ARENA_DEPTH.scarRegrowth[scar] : 1;
}

/** Concealment shift for a hider standing on scarred ground. */
export function scarCoverShift(state: SimContext['state'], zoneName: string): number {
    const scar = scarOf(state, zoneName);
    return scar ? ARENA_DEPTH.scarCover[scar] : 0;
}

/** Whether the scar forbids this effect starting here (nothing left to burn, too wet to catch). */
export function scarBlocks(state: SimContext['state'], zoneName: string, kind: ZoneEffectKind): boolean {
    const scar = scarOf(state, zoneName);
    if (!scar) return false;
    if (kind === 'burning') return scar === 'burnt' || scar === 'flooded';
    if (kind === 'quaking') return scar === 'collapsed';
    return false;
}

const SCAR_LINE: Record<ZoneScarKind, (z: string) => string> = {
    burnt: z => `${z} is black ground now: ash to the ankle, nothing to eat, nowhere to hide, and nothing left that can burn.`,
    flooded: z => `The water has gone down in ${z}, but it has left the ground drowned: silt, standing pools and everything worth eating rotted.`,
    collapsed: z => `${z} will not be what it was. What came down stays down, and the rubble is a maze of places to crouch.`,
    trampled: z => `So many people have come through ${z} that the ground is beaten flat. Every trail is readable and the forage is stamped into the mud.`,
};

function scarZone(ctx: SimContext, zoneName: string, kind: ZoneScarKind) {
    const d = depth(ctx);
    const cycle = cycleOf(ctx.state);
    const current = d.scars?.[zoneName];
    const live = current && cycle <= current.untilCycle;
    if (live && SCAR_RANK[current!.kind] > SCAR_RANK[kind]) return;
    const untilCycle = cycle + ARENA_DEPTH.scarCycles[kind];
    d.scars = { ...(d.scars ?? {}), [zoneName]: { kind, untilCycle } };
    if (!live || current!.kind !== kind) {
        bump(ctx, `scar:${kind}`);
        ctx.logEvent(SCAR_LINE[kind](zoneName), [], { zone: zoneName, category: 'arena' });
    }
}

function tickScars(ctx: SimContext) {
    const state = ctx.state;
    const d = depth(ctx);
    const cycle = cycleOf(state);
    const fallen = fallenZones(state);
    const traffic = state.zoneTraffic ?? {};
    state.arena.zones.forEach(z => {
        if (hasEffect(state, z.name, 'burning')) scarZone(ctx, z.name, 'burnt');
        else if (hasEffect(state, z.name, 'flooded')) scarZone(ctx, z.name, 'flooded');
        else if (fallen.includes(z.name) || hasEffect(state, z.name, 'quaking')) scarZone(ctx, z.name, 'collapsed');
        else {
            const through = Object.entries(traffic)
                .filter(([key]) => key === z.name || key.split('|').includes(z.name))
                .reduce((a, [, n]) => a + n, 0);
            if (through >= ARENA_DEPTH.trampleTraffic) scarZone(ctx, z.name, 'trampled');
        }
    });
    // Healing: burnt ground greens over in a flush — ash is fertile.
    Object.entries(d.scars ?? {}).forEach(([zone, scar]) => {
        if (cycle <= scar.untilCycle) return;
        const scars = { ...(d.scars ?? {}) };
        delete scars[zone];
        d.scars = scars;
        if (scar.kind === 'burnt' && !(state.collapsedZones ?? []).includes(zone)) {
            const dep = state.zoneDepletion?.[zone];
            if (dep !== undefined) state.zoneDepletion![zone] = Math.round(dep * (1 - ARENA_DEPTH.ashBloomRestore) * 1000) / 1000;
            startZoneEffect(ctx, zone, 'blooming', false);
            bump(ctx, 'ashBlooms');
            ctx.logEvent(`Green shoots come up through the ash in ${zone}. Burnt ground grows back fast, and it grows back rich.`, [], { zone, category: 'arena' });
        }
    });
}

// =====================================================================================
// Hidden cache
// =====================================================================================

function isFinder(t: Tribute): boolean {
    return t.archetype === 'cartographer' || t.archetype === 'tracker'
        || has(t, 'Tracker') || has(t, 'Reads Ground');
}

function ensureCache(ctx: SimContext) {
    const d = depth(ctx);
    if (d.hiddenCache) return;
    const rng = new RNG(`${ctx.state.seed}-depth-cache`);
    const horn = ctx.state.arena.zones[0]?.name;
    const all = ctx.state.arena.zones.filter(z => z.name !== horn && !/cornucopia/i.test(z.name));
    // AUDIT-12 E8: hide it where the border reaches last — the back half of
    // the collapse order — so a plan to it is not a plan into the void.
    const order = buildCollapseOrder(ctx);
    const late = new Set(order.slice(Math.floor(order.length / 2)));
    const fallen = fallenZones(ctx.state);
    const safe = all.filter(z => late.has(z.name) && !fallen.includes(z.name));
    const options = safe.length > 0 ? safe : all;
    if (options.length === 0) return;
    d.hiddenCache = { zone: rng.pick(options).name, knownBy: [] };
}

function tickCache(ctx: SimContext) {
    ensureCache(ctx);
    const state = ctx.state;
    const cache = state.arenaDepth?.hiddenCache;
    if (!cache || cache.foundBy || state.day < ARENA_DEPTH.cacheFromDay) return;
    if ((state.collapsedZones ?? []).includes(cache.zone)) return;
    const rng = streamOf(ctx, 'cache');
    const alive = getAlive(state);

    // The supply trail: a Cartographer or Tracker reads where it goes.
    if (state.day >= ARENA_DEPTH.cacheHintDay) {
        alive.filter(t => isFinder(t) && !cache.knownBy.includes(t.id)).forEach(t => {
            cache.knownBy = [...cache.knownBy, t.id];
            bump(ctx, 'cacheHints');
            ctx.logEvent(
                `${t.name} notices what nobody else has: the Gamemakers' own supply trail, crates dragged and brushed over, leading toward ${cache.zone}.`,
                [t.id], { category: 'survival' });
        });
    }

    const here = rng.shuffle(alive.filter(t => t.zone === cache.zone));
    const finder = here.find(t => rng.chance(
        isFinder(t) || cache.knownBy.includes(t.id) ? ARENA_DEPTH.cacheFinderChance : ARENA_DEPTH.cacheOtherChance));
    if (!finder) return;
    const pool = [
        ITEMS.filter(i => i.type === 'weapon'),
        ITEMS.filter(i => i.type === 'medical'),
        ITEMS.filter(i => i.type === 'food' || i.type === 'water'),
    ];
    const got: Item[] = [];
    for (let i = 0; i < ARENA_DEPTH.cacheItems; i++) {
        const list = pool[i % pool.length];
        if (list.length === 0) continue;
        got.push(mintItem(rng, rng.pick(list), ARENA_DEPTH.cacheQualityBias));
    }
    giveItem(finder, ...got);
    cache.foundBy = finder.id;
    cache.foundCycle = cycleOf(state);
    bump(ctx, isFinder(finder) || cache.knownBy.includes(finder.id) ? 'cacheFoundByFinder' : 'cacheFoundByOther');
    ctx.logEvent(
        `${finder.name} pulls back a mat of brush in ${cache.zone} and finds the arena's second cache — the one the Gamemakers never announced: ${got.map(itemPhrase).join(', ')}.`,
        [finder.id], { important: true, zone: cache.zone, category: 'loot' });
}

// =====================================================================================
// Arena acts
// =====================================================================================

interface ActStep {
    text: string;
    /** Effect to start, on up to `actMaxZones` zones of these terrains. */
    start?: { kind: ZoneEffectKind; terrains: Terrain[] };
    /** Effects to end everywhere. */
    end?: ZoneEffectKind[];
    /** Cut every edge touching a zone of these terrains (restored at the next act). */
    cutAround?: Terrain[];
    /** Put back whatever the previous act cut. */
    restoreCuts?: boolean;
    /** Weather this act favours. */
    weather?: WeatherKind;
}

/** Arenas that had no transformation of their own. [act II, act III]. */
const ACTS: Record<string, [ActStep, ActStep]> = {
    frozen: [
        {
            text: 'The thaw comes to the Frozen Wasteland all at once. The lake groans, the channel runs, and the ice that half the arena was walking on is water again.',
            start: { kind: 'flooded', terrains: ['water', 'ice', 'wetland'] },
            cutAround: ['water'],
            weather: 'rain',
        },
        {
            text: 'The Gamemakers drop the temperature through the floor. The floodwater refreezes where it stands, and the arena is one hard, slick sheet again.',
            end: ['flooded'],
            start: { kind: 'frozen', terrains: ['water', 'ice', 'wetland', 'open'] },
            restoreCuts: true,
            weather: 'storm',
        },
    ],
    solar: [
        {
            text: 'The second sun comes up over the Solar Desert. Nobody was told there was a second sun.',
            start: { kind: 'burning', terrains: ['forest', 'wetland'] },
            weather: 'heat',
        },
        {
            text: 'The desert wind rises and does not drop. The dunes are moving now, and the sand is in everything.',
            start: { kind: 'fogbound', terrains: ['open', 'desert'] },
            weather: 'storm',
        },
    ],
    toxic: [
        {
            text: 'The swamp blooms. Something in the water has woken up, and every channel runs green and sweet-smelling and wrong.',
            start: { kind: 'contaminated', terrains: ['water', 'wetland'] },
            weather: 'fog',
        },
        {
            text: 'The bloom dies back and rots. The water is foul, the air is worse, and the causeways are going under.',
            start: { kind: 'flooded', terrains: ['wetland', 'open'] },
            cutAround: ['water'],
            weather: 'rain',
        },
    ],
    tempest: [
        {
            text: 'The tide turns, and keeps turning. The sea comes in over the low ground, and the ways between the terraces are underwater.',
            start: { kind: 'flooded', terrains: ['wetland', 'water', 'ruins'] },
            cutAround: ['water'],
            weather: 'storm',
        },
        {
            text: 'The eye of the storm passes over. The water drains back out of the arena in a single roaring hour, and the ground it leaves is new.',
            end: ['flooded'],
            restoreCuts: true,
            weather: 'fog',
        },
    ],
    ashfall: [
        {
            text: 'The caldera clears its throat. Ash comes down like snow over the whole arena, and the woods start to smoulder.',
            start: { kind: 'burning', terrains: ['forest'] },
            weather: 'heat',
        },
        {
            text: 'The mountain opens. Lava finds the low ground and the paths across it are gone.',
            start: { kind: 'burning', terrains: ['open', 'wetland'] },
            cutAround: ['highland'],
            weather: 'storm',
        },
    ],
};

/** Whether this arena has an act track here. */
export function hasActs(arenaId: string): boolean {
    return ACTS[arenaId] !== undefined;
}

function tickActs(ctx: SimContext) {
    const state = ctx.state;
    const acts = ACTS[state.arena.id];
    if (!acts) return;
    const d = depth(ctx);
    const act = d.act ?? 1;
    if (act > acts.length) return;
    const next = act; // index into acts: act 1 -> acts[0] is act II
    const alive = getAlive(state).length;
    const total = state.tributes.length;
    const dayGate = state.day >= ARENA_DEPTH.actDays[next - 1];
    const fieldGate = alive <= Math.ceil(total * ARENA_DEPTH.actAliveShare[next - 1]);
    if (!dayGate && !fieldGate) return;
    const step = acts[next - 1];
    d.act = act + 1;
    bump(ctx, `act:${d.act}`);
    ctx.logEvent(step.text, [], { important: true, category: 'arena' });

    const rng = streamOf(ctx, 'act');
    const collapsed = state.collapsedZones ?? [];
    const horn = state.arena.zones[0]?.name;
    if (step.end) state.arena.zones.forEach(z => step.end!.forEach(k => endZoneEffect(state, z.name, k)));
    if (step.restoreCuts && d.actCuts?.length) {
        // AUDIT-12 E2: only the edges the act still owns come back.
        d.actCuts.forEach(e => releaseActCut(state, e));
        d.actCuts = [];
    }
    if (step.start) {
        const targets = rng.shuffle(state.arena.zones.filter(z =>
            z.name !== horn && !collapsed.includes(z.name) && step.start!.terrains.includes(z.terrain)))
            .slice(0, ARENA_DEPTH.actMaxZones);
        targets.forEach(z => { if (!scarBlocks(state, z.name, step.start!.kind)) startZoneEffect(ctx, z.name, step.start!.kind); });
    }
    if (step.cutAround) {
        const cuts: string[] = [];
        const severed = state.severedEdges ?? (state.severedEdges = []);
        const openEdges = (name: string) => (getZone(state.arena, name)?.adjacent ?? [])
            .filter(m => !collapsed.includes(m) && !severed.includes(edgeKey(name, m))).length;
        state.arena.zones.filter(z => step.cutAround!.includes(z.terrain) && z.name !== horn && !collapsed.includes(z.name)).forEach(z => {
            z.adjacent.forEach(n => {
                const key = edgeKey(z.name, n);
                if (severed.includes(key) || n === horn || collapsed.includes(n)) return;
                // AUDIT-12 E1: never strand a zone — neither end may lose its last open edge.
                if (openEdges(n) <= 1 || openEdges(z.name) <= 1) return;
                severed.push(key);
                markActCut(state, key);
                cuts.push(key);
            });
        });
        d.actCuts = [...(d.actCuts ?? []), ...cuts];
    }
    unstrandZones(state);
    setMark(state, 'depthActWeather', step.weather);
}

// =====================================================================================
// Crafted kit and weapon failure
// =====================================================================================

/**
 * Makes the two pieces of kit the field could not: a snare kit (a set of
 * prepared lines, spent a trap at a time by `setTrap`) and a bivouac sheet
 * (woven cover that turns a storm and wears out doing it). Called right after
 * the weapon crafting in `dayNight`.
 */
export function craftKit(ctx: SimContext, t: Tribute) {
    if (!canAfford(t, ACTION_BUDGET.craftHours)) return;
    const zone = getZone(ctx.state.arena, t.zone);
    if (!zone) return;
    const rng = new RNG(`${ctx.state.seed}-depth-craft-${t.id}-${cycleOf(ctx.state)}`);
    const green = zone.terrain === 'forest' || zone.terrain === 'wetland';
    const skill = profOf(t, 'knots') + profOf(t, 'tracking');
    if (green && !t.inventory.some(i => i.id === 'snare-kit')
        && skill >= ARENA_DEPTH.snareKitSkill && rng.chance(ARENA_DEPTH.snareKitChance)) {
        const def = IMPROVISED_ITEMS.find(i => i.id === 'snare-kit');
        if (def) {
            giveItem(t, mintItem(rng, def, QUALITY_BIAS.improvised));
            spend(t, ACTION_BUDGET.craftHours);
            bump(ctx, 'craft:snare-kit');
            ctx.logEvent(`${t.name} spends the morning twisting bark and vine into a coil of ready-made snare lines, and packs them away for later.`, [t.id], { category: 'loot' });
            return;
        }
    }
    const weatherComing = ctx.state.arenaDepth?.incoming?.braced.includes(t.id)
        && (ctx.state.arenaDepth.incoming.kind === 'storm' || ctx.state.arenaDepth.incoming.kind === 'rain');
    if (green && weatherComing && !hasBivouac(t) && rng.chance(ARENA_DEPTH.bivouacChance)) {
        const def = IMPROVISED_ITEMS.find(i => i.id === 'bivouac');
        if (def) {
            giveItem(t, mintItem(rng, def, QUALITY_BIAS.improvised));
            spend(t, ACTION_BUDGET.craftHours);
            bump(ctx, 'craft:bivouac');
            ctx.logEvent(`${t.name} has read the weather and weaves a rough bivouac sheet out of reeds and boughs before it arrives.`, [t.id], { category: 'loot' });
        }
    }
}

/**
 * A weapon worn through mid-fight. Called by `combat.ts` the moment its
 * durability crosses zero: the break is announced, and it can open the hand
 * that was holding it — a snapping spear shaft, a shattering blade.
 */
export function weaponFails(ctx: SimContext, t: Tribute, weapon: Item) {
    bump(ctx, 'weaponFailures');
    const rng = new RNG(`${ctx.state.seed}-depth-break-${t.id}-${cycleOf(ctx.state)}`);
    if (!rng.chance(ARENA_DEPTH.weaponFailInjuryChance)) {
        ctx.logEvent(`${t.name}'s ${weapon.name} gives out in the middle of the fight.`, [t.id], { category: 'combat' });
        return;
    }
    bump(ctx, 'weaponFailureInjuries');
    ctx.logEvent(`${t.name}'s ${weapon.name} breaks apart in their hands, and the broken end goes into them.`, [t.id], { category: 'injury' });
    injure(t, 'arms');
    const cause = `Killed when their ${weapon.name} broke in their hands`;
    applyDamage(ctx, t, ARENA_DEPTH.weaponFailDamage, { cause, kind: 'hazard', code: 'hazard' });
    checkDeath(ctx, t, cause);
}

// =====================================================================================
// Plans
// =====================================================================================

function nearest(ctx: SimContext, from: string, test: (z: Zone) => boolean): string | undefined {
    const collapsed = ctx.state.collapsedZones ?? [];
    const seen = new Set([from]);
    let frontier = [from];
    for (let hop = 0; hop < ARENA_DEPTH.planMaxHops; hop++) {
        const next: string[] = [];
        for (const name of frontier) {
            for (const n of getZone(ctx.state.arena, name)?.adjacent ?? []) {
                if (seen.has(n) || collapsed.includes(n)) continue;
                seen.add(n);
                const z = getZone(ctx.state.arena, n);
                if (z && test(z)) return n;
                next.push(n);
            }
        }
        frontier = next;
    }
    return undefined;
}

const URGENT = new Set(['flee', 'hunt', 'protect', 'stalk', 'court', 'recover']);

export function planOf(state: SimContext['state'], t: Tribute): TributePlan | undefined {
    return state.arenaDepth?.plans?.[t.id];
}

/** AUDIT-12 E9: the dead keep no plans — called from `killTribute`. */
export function dropPlan(state: SimContext['state'], id: string) {
    const plans = state.arenaDepth?.plans;
    if (!plans || !(id in plans)) return;
    const next = { ...plans };
    delete next[id];
    state.arenaDepth!.plans = next;
}

function setPlan(ctx: SimContext, t: Tribute, plan: TributePlan | undefined) {
    const d = depth(ctx);
    const plans = { ...(d.plans ?? {}) };
    if (plan) plans[t.id] = plan;
    else delete plans[t.id];
    d.plans = plans;
}

function makePlan(ctx: SimContext, t: Tribute, rng: RNG): TributePlan | undefined {
    const cycle = cycleOf(ctx.state);
    const home = t.zone;
    const here = getZone(ctx.state.arena, home);
    if (!here) return undefined;
    const cache = ctx.state.arenaDepth?.hiddenCache;
    const steps = (list: Array<[string | undefined, ObjectiveReason]>) =>
        list.filter((s): s is [string, ObjectiveReason] => s[0] !== undefined).map(([zone, reason]) => ({ zone, reason }));

    // AUDIT-12 E8: not to a zone that has already fallen.
    const cacheGone = !!cache && ((ctx.state.collapsedZones ?? []).includes(cache.zone) || fallenZones(ctx.state).includes(cache.zone));
    if (cache && !cacheGone && !cache.foundBy && cache.knownBy.includes(t.id) && cache.zone !== home) {
        return { label: `the unannounced cache in ${cache.zone}`, steps: steps([[cache.zone, 'forage'], [home, 'shelter']]), step: 0, madeCycle: cycle, interruptions: 0 };
    }
    if (t.health < ARENA_DEPTH.planHurtBelow) {
        const refuge = nearest(ctx, home, z => (zoneFeatures(z).shelterQuality ?? 0) >= ARENA_DEPTH.exposedShelterBelow * 2);
        const water = refuge ? nearest(ctx, refuge, z => zoneFeatures(z).waterSource === true) : undefined;
        if (refuge) return { label: `falling back to ${refuge}`, steps: steps([[refuge, 'shelter'], [water, 'water']]), step: 0, madeCycle: cycle, interruptions: 0 };
    }
    if (t.vitals.thirst >= ARENA_DEPTH.planThirst && !zoneFeatures(here).waterSource) {
        const water = nearest(ctx, home, z => zoneFeatures(z).waterSource === true);
        if (!water) return undefined;
        // A longer errand when they are hungry too: water, then the richest
        // ground near it, then back.
        const forage = t.vitals.hunger >= ARENA_DEPTH.planThirst && rng.chance(ARENA_DEPTH.planChance)
            ? nearest(ctx, water, z => z.resources >= here.resources && z.name !== home)
            : undefined;
        return { label: `a water run to ${water}`, steps: steps([[water, 'water'], [forage, 'forage'], [home, 'shelter']]), step: 0, madeCycle: cycle, interruptions: 0 };
    }
    return undefined;
}

/**
 * Called right after `updateObjective`. A plan is held across cycles and
 * across interruptions: when the cascade has picked something urgent the plan
 * waits (and counts it); otherwise the plan's current step *is* the objective,
 * rather than whatever this cycle's roll would have settled for.
 */
export function followPlan(ctx: SimContext, t: Tribute) {
    const cycle = cycleOf(ctx.state);
    let plan = planOf(ctx.state, t);
    // AUDIT-11 (tuning): the clock only runs while the plan is being worked.
    // A fight or a flight that sets it aside for three cycles is one
    // interruption, not three, and those cycles are not the plan running late
    // — measured, 1.3 of the 2.3 plans abandoned per run were a single long
    // interruption counted cycle by cycle, and another 0.95 ran out of a clock
    // that had kept ticking through it.
    const late = (p: TributePlan) => cycle - p.madeCycle - (p.pausedCycles ?? 0) > ARENA_DEPTH.planMaxCycles
        || cycle - p.madeCycle > ARENA_DEPTH.planMaxAge;
    if (plan && (late(plan) || plan.interruptions > ARENA_DEPTH.planMaxInterruptions)) {
        bump(ctx, 'plansAbandoned');
        bump(ctx, late(plan) ? 'plansAbandonedLate' : 'plansAbandonedInterrupted');
        setPlan(ctx, t, undefined);
        plan = undefined;
    }
    if (!plan) {
        const rng = new RNG(`${ctx.state.seed}-depth-plan-${t.id}-${cycle}`);
        if (!rng.chance(ARENA_DEPTH.planChance)) return;
        plan = makePlan(ctx, t, rng);
        if (!plan || plan.steps.length < 2) return;
        setPlan(ctx, t, plan);
        bump(ctx, 'plansMade');
        ctx.logEvent(`${t.name} makes a plan and means to keep it: ${plan.label}, ${plan.steps.map(s => s.zone).join(', then ')}.`, [t.id], { category: 'survival' });
    }
    // AUDIT-12 E8: a step into ground that has since fallen ends the plan.
    const gone = (ctx.state.collapsedZones ?? []);
    if (plan.steps.slice(plan.step).some(st => gone.includes(st.zone))) {
        bump(ctx, 'plansAbandoned');
        setPlan(ctx, t, undefined);
        return;
    }
    // Advance past any step they are standing on.
    while (plan.step < plan.steps.length && plan.steps[plan.step].zone === t.zone) plan.step++;
    if (plan.step >= plan.steps.length) {
        bump(ctx, 'plansCompleted');
        if (plan.interruptions > 0) bump(ctx, 'plansCompletedThroughInterruption');
        setPlan(ctx, t, undefined);
        return;
    }
    const obj = t.objective;
    if (obj && URGENT.has(obj.kind)) {
        if (plan.lastInterrupted !== cycle) {
            // A new interruption only if the last cycle was not already one.
            if (plan.lastInterrupted !== cycle - 1) {
                plan.interruptions++;
                bump(ctx, 'planInterruptions');
            }
            plan.pausedCycles = (plan.pausedCycles ?? 0) + 1;
            plan.lastInterrupted = cycle;
        }
        setPlan(ctx, t, { ...plan });
        return;
    }
    const step = plan.steps[plan.step];
    t.objective = { kind: 'reach', zone: step.zone, reason: step.reason, expires: cycle + OBJECTIVES.reachCycles };
    setPlan(ctx, t, { ...plan });
}

// =====================================================================================
// Deception
// =====================================================================================

function pursuers(ctx: SimContext, t: Tribute): Tribute[] {
    return getAlive(ctx.state).filter(o => o.id !== t.id
        && ((o.objective?.kind === 'hunt' && o.objective.targetId === t.id)
            || (o.objective?.kind === 'stalk' && o.objective.targetId === t.id)
            || o.shadowing?.targetId === t.id));
}

function isSchemer(t: Tribute): boolean {
    return t.archetype === 'trickster' || t.archetype === 'saboteur' || t.archetype === 'ghost'
        || t.archetype === 'strategist' || t.attributes.intelligence >= ARENA_DEPTH.decoySeeThrough;
}

const feintKey = (feigner: string, fooled: string) => `${feigner}>${fooled}`;

/** Combat power a feigner has over somebody who came in believing the limp. */
export function deceptionEdge(state: SimContext['state'], t: Tribute, opponent: Tribute | undefined): number {
    if (!opponent) return 0;
    // AUDIT-12 E10: only against somebody who saw the limp and believed it.
    // The fooled are recorded as `${feigner}>${fooled}` keys beside the
    // feigner's own entry, sharing its expiry.
    const until = state.arenaDepth?.feints?.[feintKey(t.id, opponent.id)];
    if (until === undefined || (state.cycle ?? 0) > until) return 0;
    return ARENA_DEPTH.feignCombatEdge;
}

function tickDeception(ctx: SimContext) {
    const state = ctx.state;
    const d = depth(ctx);
    const cycle = cycleOf(state);
    const rng = streamOf(ctx, 'deceive');
    // Expire.
    d.feints = Object.fromEntries(Object.entries(d.feints ?? {}).filter(([, u]) => u >= cycle));
    d.decoys = Object.fromEntries(Object.entries(d.decoys ?? {}).filter(([, v]) => v.untilCycle >= cycle));

    getAlive(state).forEach(t => {
        if (t.attributes.intelligence < ARENA_DEPTH.decoyIntelligence && !isSchemer(t)) return;
        const hunters = pursuers(ctx, t);

        // Fake camp: a fire and a bedroll somewhere they are not.
        if (hunters.length > 0 && !d.decoys?.[t.id] && rng.chance(ARENA_DEPTH.decoyChance)) {
            const options = (getZone(state.arena, t.zone)?.adjacent ?? []).filter(n => !(state.collapsedZones ?? []).includes(n));
            if (options.length === 0) return;
            const decoy = rng.pick(options);
            d.decoys = { ...(d.decoys ?? {}), [t.id]: { zone: decoy, untilCycle: cycle + ARENA_DEPTH.decoyCycles } };
            let fooled = 0;
            hunters.forEach(h => {
                if (h.attributes.intelligence >= ARENA_DEPTH.decoySeeThrough) return;
                const rec = rivalRecord(h, t.id);
                rec.lastSeenZone = decoy;
                rec.lastSeenCycle = cycle;
                fooled++;
            });
            bump(ctx, 'decoyCamps');
            bump(ctx, 'decoyFooled', fooled);
            ctx.logEvent(
                `${t.name} builds a camp in ${decoy} — a fire banked to smoke, a bedroll stuffed with leaves — and leaves it for whoever is following.`,
                [t.id], { zone: decoy, category: 'survival' });
            return;
        }

        // Feigned wound: a limp for an audience, near ground they chose.
        const baiting = t.stance === 'Baiting' || (isSchemer(t) && t.inventory.some(i => i.type === 'weapon'));
        if (!baiting || d.feints?.[t.id] !== undefined) return;
        const near = new Set([t.zone, ...(getZone(state.arena, t.zone)?.adjacent ?? [])]);
        const audience = getAlive(state).filter(o => o.id !== t.id && near.has(o.zone)
            && !allied(o, t));
        if (audience.length === 0 || !rng.chance(ARENA_DEPTH.feignChance)) return;
        const until = cycle + ARENA_DEPTH.feignCycles;
        d.feints = { ...(d.feints ?? {}), [t.id]: until, ...Object.fromEntries(audience.map(o => [feintKey(t.id, o.id), until])) };
        audience.forEach(o => {
            const rec = rivalRecord(o, t.id);
            rec.lastSeenZone = t.zone;
            rec.lastSeenCycle = cycle;
            rec.lastSeenHealth = Math.round(t.health * ARENA_DEPTH.feignHealthScale);
        });
        bump(ctx, 'feints');
        ctx.logEvent(
            `${t.name} lets themselves be seen in ${t.zone}, limping badly and clutching their side. None of it is real.`,
            [t.id], { zone: t.zone, category: 'survival' });
    });
}

// =====================================================================================
// Risk curve
// =====================================================================================

function lateFactor(state: SimContext['state']): number {
    const alive = state.tributes.filter(t => t.status === 'alive').length;
    return Math.max(0, Math.min(1, (ARENA_DEPTH.riskLateField - alive) / ARENA_DEPTH.riskLateField));
}

function desperation(t: Tribute): number {
    const need = Math.max(t.vitals.hunger, t.vitals.thirst) / 100;
    const hurt = (100 - t.health) / 100;
    return Math.max(0, Math.min(1, (need + hurt) / 2));
}

function isPacifist(t: Tribute): boolean {
    return (ARCHETYPES[t.archetype]?.aggression ?? 0) < ARENA_DEPTH.pacifistAggressionBelow;
}

/**
 * Additive shift on `riskTolerance`. Pure: reads the turn/break lists the
 * tick writes, and the tribute's own state. Zero before the late game.
 */
export function riskShift(state: SimContext['state'], t: Tribute): number {
    const late = lateFactor(state);
    if (late <= 0) return 0;
    let shift = desperation(t) * late * ARENA_DEPTH.riskDesperationWeight;
    if (state.arenaDepth?.turned?.includes(t.id)) shift += ARENA_DEPTH.hoarderTurn * late;
    if (state.arenaDepth?.broken?.includes(t.id)) shift += ARENA_DEPTH.pacifistBreak;
    return shift;
}

function tickRisk(ctx: SimContext) {
    const state = ctx.state;
    if (lateFactor(state) <= 0) return;
    const d = depth(ctx);
    getAlive(state).forEach(t => {
        if (!d.turned?.includes(t.id) && t.kills === 0 && inventoryValue(t) >= ARENA_DEPTH.hoarderKit && !isPacifist(t)) {
            d.turned = [...(d.turned ?? []), t.id];
            bump(ctx, 'hoardersTurned');
            ctx.logEvent(
                `${t.name} has sat on the best-stocked pack in the arena for days. Somewhere in the last few cannons the arithmetic changed: the pack is no longer something to protect, it is something to use.`,
                [t.id], { important: true, category: 'survival' });
        }
        if (!d.broken?.includes(t.id) && isPacifist(t) && desperation(t) >= ARENA_DEPTH.pacifistBreakAt) {
            d.broken = [...(d.broken ?? []), t.id];
            bump(ctx, 'pacifistsBroken');
            ctx.logEvent(
                `Something goes out of ${t.name}. Hungry, hurt and one of the last few alive, the promise not to hurt anybody stops being a thing they can afford.`,
                [t.id], { important: true, category: 'sanity' });
        }
    });
}

// =====================================================================================
// The tick
// =====================================================================================

/** Once per cycle, from `processDayNight`'s arena upkeep. */
export function tickArenaDepth(ctx: SimContext) {
    tickActs(ctx);
    tickWeather(ctx);
    tickScars(ctx);
    tickCache(ctx);
    tickDeception(ctx);
    tickRisk(ctx);
    tickEnclosedSmoke(ctx);
}

/**
 * AUDIT-12 §8.10: a fire in an enclosed-ignition room has nowhere to vent.
 * Anybody inside a burning room of that kind breathes it — the rooms the
 * Malt House flashes through are the rooms that choke people between flashes.
 */
function tickEnclosedSmoke(ctx: SimContext) {
    const state = ctx.state;
    if (!state.arena.rules?.enclosedIgnition) return;
    state.arena.zones.forEach(z => {
        if (!isEnclosedIgnitionZone(state, z.name) || !hasEffect(state, z.name, 'burning')) return;
        const inside = getAlive(state).filter(t => t.zone === z.name && !t.downed);
        if (inside.length === 0) return;
        bump(ctx, 'enclosedSmoke', inside.length);
        ctx.logEvent(
            `The smoke in ${z.name} has nowhere to go. ${inside.map(t => t.name).join(' and ')} ${inside.length === 1 ? 'is' : 'are'} breathing it.`,
            inside.map(t => t.id), { important: true, zone: z.name, category: 'hazard' });
        const cause = `Choked on the smoke trapped in ${z.name}`;
        inside.forEach(t => {
            t.vitals.fatigue += AUDIT12_ARENA.enclosedSmokeFatigue;
            applyDamage(ctx, t, AUDIT12_ARENA.enclosedSmokeDamage, { cause, kind: 'hazard', code: 'asphyxiation' });
            clampTribute(t);
            checkDeath(ctx, t, cause);
        });
    });
}
