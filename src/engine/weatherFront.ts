import { RNG } from '../utils/rng';
import { WEATHER_FRONT } from '../data/balance';
import { SimContext, getAlive } from './context';
import { ExposureProfile, applyExposure } from './exposure';
import { getZone } from './map';
import { addZoneThreat } from './memory';
import { MEMORY } from '../data/balance';

/**
 * Weather that moves.
 *
 * Climate was static per arena — `climateOf(arena.id)` returned one profile and
 * applied it to everybody, everywhere, every cycle — and the only transient
 * weather in the game came from a Gamemaker button or a wildcard, hit the whole
 * arena at once, and lasted exactly one phase. So weather was either permanent
 * background or a single global spike, and never a thing you could see coming
 * or get out of the way of.
 *
 * A front is a storm with a position. It enters at one zone, walks the
 * adjacency graph a zone or two per cycle, and blows itself out. Tributes in
 * its path take real exposure; tributes who can see where it is going can move.
 * It uses the exposure system that already exists, so a front is a profile plus
 * a location rather than a new damage path.
 */

export interface WeatherFront {
    /** Which profile is blowing through. Index into `FRONTS`. */
    kind: number;
    /** Where it is right now. */
    zone: string;
    /** Zones it has already crossed, so it does not double back immediately. */
    crossed: string[];
    /** Cycle it blows out on. */
    expiresCycle: number;
}

const FRONTS: ExposureProfile[] = [
    {
        name: 'a wall of driving rain',
        cause: 'Died of exposure in the storm front',
        damage: 4,
        fatigue: 20,
        sanity: 8,
        quench: 35,
    },
    {
        name: 'a hard, sudden freeze',
        cause: 'Froze to death in the cold front',
        damage: 6,
        fatigue: 22,
        frostbite: 0.2,
        wardedBy: 'sleeping-bag',
        onFrostbite: t => `${t.name} cannot feel their hands by the time the front has passed.`,
    },
    {
        name: 'a scouring dust storm',
        cause: 'Flayed by the dust front',
        damage: 7,
        fatigue: 18,
        thirst: 20,
        infection: 0.15,
    },
    {
        name: 'a bank of sour fog',
        cause: 'Suffocated in the fog front',
        damage: 3,
        fatigue: 10,
        sanity: 22,
        poison: 0.12,
        onPoison: t => `${t.name} breathes too much of the fog before they find the edge of it.`,
    },
    // §8.3: "weather variety beyond the front system" — the variety belongs
    // *in* the front system, which already moves, telegraphs and expires.
    // Four profiles meant the same storm every third run; these five widen
    // the repertoire, including the two the pool conspicuously lacked: heat,
    // and weather that helps.
    {
        name: 'a heat wave with no shade in it',
        cause: 'Succumbed to heatstroke in the front',
        damage: 5,
        fatigue: 24,
        thirst: 28,
        burn: 0.1,
    },
    {
        name: 'a hailstorm throwing stones the size of eggs',
        cause: 'Beaten down by the hail front',
        damage: 9,
        fatigue: 12,
        sanity: 6,
    },
    {
        name: 'a soft, soaking drizzle',
        // Weather that is genuinely useful: it fills whatever can catch
        // water and costs only comfort. A front the tributes are glad to
        // see is what makes the frightening ones read as frightening.
        cause: 'Died of exposure in the long rain',
        fatigue: 8,
        quench: 45,
    },
    {
        name: 'a static storm that stands the hair on end',
        cause: 'Struck in the static storm',
        damage: 8,
        sanity: 16,
        fatigue: 10,
    },
    {
        name: 'a wet snow that erases every track',
        cause: 'Froze in the snow front',
        damage: 4,
        fatigue: 20,
        frostbite: 0.12,
        wardedBy: 'sleeping-bag',
    },
];

/** Human-readable name of whatever is currently blowing through. */
export function frontName(front: WeatherFront): string {
    return FRONTS[front.kind % FRONTS.length].name;
}

/** Where the front is now and where it is heading — the telegraph. */
function nextZone(ctx: SimContext, front: WeatherFront, rng: RNG): string | undefined {
    const zone = getZone(ctx.state.arena, front.zone);
    if (!zone) return undefined;
    const collapsed = ctx.state.collapsedZones ?? [];
    // A front crosses ground, so it ignores severed edges — a broken bridge
    // does not stop weather. It does not immediately double back, though.
    const options = zone.adjacent.filter(n => !collapsed.includes(n) && !front.crossed.includes(n));
    const pool = options.length > 0
        ? options
        : zone.adjacent.filter(n => !collapsed.includes(n));
    return pool.length > 0 ? rng.pick(pool) : undefined;
}

/**
 * Per-cycle: move the standing front, hurt whoever it is over, and occasionally
 * start a new one. Called from `processDayNight` alongside the other arena
 * upkeep.
 */
export function tickWeatherFront(ctx: SimContext) {
    const cycle = ctx.state.cycle ?? 0;
    const rng = new RNG(`${ctx.state.seed}-front-${cycle}`);
    const collapsed = ctx.state.collapsedZones ?? [];
    const active = ctx.state.arena.zones.map(z => z.name).filter(n => !collapsed.includes(n));
    if (active.length === 0) return;

    let front = ctx.state.weatherFront;

    // Blow out.
    if (front && cycle >= front.expiresCycle) {
        ctx.logEvent(
            `${frontName(front).replace(/^a /, 'The ')} finally passes out of the arena.`,
            [],
            { category: 'arena' }
        );
        front = undefined;
        ctx.state.weatherFront = undefined;
    }

    // Move an existing one.
    if (front) {
        const next = nextZone(ctx, front, rng);
        if (next) {
            front.crossed = [...front.crossed, front.zone].slice(-WEATHER_FRONT.memoryZones);
            front.zone = next;
        }
        const heading = nextZone(ctx, front, rng);
        ctx.logEvent(
            `${frontName(front).replace(/^a /, 'The ')} moves over ${front.zone}`
            + (heading ? `, and ${heading} is next in its path.` : '.'),
            [],
            { important: true, zone: front.zone, category: 'arena' }
        );

        const profile = FRONTS[front.kind % FRONTS.length];
        getAlive(ctx.state).forEach(t => {
            if (t.zone !== front!.zone) return;
            applyExposure(ctx, t, profile);
            addZoneThreat(ctx.state, t, t.zone, MEMORY.hazardThreat);
        });
        // Everyone can see where it is going, which is what makes it dodgeable.
        if (heading) {
            getAlive(ctx.state).forEach(t => addZoneThreat(ctx.state, t, heading, MEMORY.cannonThreat));
        }
        ctx.state.weatherFront = front;
        return;
    }

    // Or start a new one, occasionally.
    if (ctx.state.day < WEATHER_FRONT.earliestDay) return;
    if (!rng.chance(WEATHER_FRONT.spawnChance)) return;

    const kind = rng.nextInt(0, FRONTS.length - 1);
    const start = rng.pick(active);
    ctx.state.weatherFront = {
        kind,
        zone: start,
        crossed: [],
        expiresCycle: cycle + rng.nextInt(WEATHER_FRONT.minCycles, WEATHER_FRONT.maxCycles),
    };
    ctx.logEvent(
        `A front builds on the edge of the arena: ${FRONTS[kind].name}, coming in over ${start}. It will not stay there.`,
        [],
        { important: true, zone: start, category: 'arena' }
    );
}
