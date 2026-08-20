import { GameConfig, GameState } from '../models/types';
import { RNG } from '../utils/rng';
import {
    CAST_SHAPES, CastShape, CastShapeId, GAMES_TEMPERAMENTS, GamesTemperament,
    Wildcard, WildcardDef, WILDCARDS, WildcardKind,
} from '../data/gamesProfile';

/**
 * REPLAY-01: rolling a run's identity, once, from its seed.
 *
 * The profile is generated rather than stored on the state as a blob so that a
 * replayed seed produces the same Games — the same temperament, the same
 * wildcard, on the same day — which is what makes a shared seed worth sharing.
 *
 * The `config` the player chose at setup is still the outer authority: a
 * temperament multiplies it rather than replacing it, so a player who has
 * deliberately dialled hazards to 0.5 still gets a quieter run than one who
 * dialled them to 1.5, whatever the Capitol announced this year.
 */

export interface GamesProfile {
    /** Which Games these are. Cosmetic, and the thing the player will name them by. */
    gamesNumber: number;
    temperament: GamesTemperament;
    /** The headline disruption, read out at the reaping. Always `calendar[0]`. */
    wildcard: Wildcard;
    /**
     * REPLAY-08: the run's whole schedule, not one event.
     *
     * A single wildcard meant days 3-6 of every run were structurally
     * identical — move, forage, occasional hazard — because exactly one thing
     * was ever scheduled to happen in them. The calendar draws 2-4 distinct
     * beats and spaces them across the run, so the middle of a run has shape.
     * Standing conditions (`day: 0`) sit in here too and are folded into the
     * config by `configForProfile`.
     */
    calendar: Wildcard[];
    /** REPLAY-09: what kind of cast the bowls produced this year. */
    castShape: CastShape;
}

/** Weighted draw over the cast shapes, with the Quells overriding the roll. */
function rollCastShape(rng: RNG, calendar: Wildcard[]): CastShape {
    const byId = (id: CastShapeId) => CAST_SHAPES.find(s => s.id === id) ?? CAST_SHAPES[0];

    // A Quarter Quell is a structural change to the reaping, not a multiplier.
    // "Tributes will be reaped in bonded pairs" and "this arena has been built
    // without mercy" are announcements the cast itself has to honour.
    if (calendar.some(w => w.kind === 'quarter-quell-pairs')) return byId('bonded-pairs');
    if (calendar.some(w => w.kind === 'quarter-quell-doubled')) return byId('veteran-field');

    const total = CAST_SHAPES.reduce((sum, s) => sum + s.weight, 0);
    let roll = rng.nextFloat() * total;
    for (const shape of CAST_SHAPES) {
        roll -= shape.weight;
        if (roll <= 0) return shape;
    }
    return CAST_SHAPES[0];
}

function materialise(def: WildcardDef, rng: RNG, dayOverride?: number): Wildcard {
    const [from, to] = def.window;
    return {
        kind: def.kind,
        name: def.name,
        announcement: def.announcement,
        onFire: def.onFire,
        day: from === 0 ? 0 : dayOverride ?? rng.nextInt(from, to),
    };
}

/** Weighted draw from the wildcard pool, excluding kinds already drawn. */
function drawWildcard(rng: RNG, taken: Set<WildcardKind>): WildcardDef | undefined {
    const pool = WILDCARDS.filter(w => !taken.has(w.kind));
    if (pool.length === 0) return undefined;
    const total = pool.reduce((sum, w) => sum + w.weight, 0);
    let roll = rng.nextFloat() * total;
    let chosen = pool[pool.length - 1];
    for (const w of pool) {
        roll -= w.weight;
        if (roll <= 0) { chosen = w; break; }
    }
    return chosen;
}

/**
 * The run's event calendar: 2-4 beats, spaced out, sorted by the day they land.
 *
 * `nothing` is drawn like anything else and simply contributes no beat, which
 * is how a genuinely quiet year still happens.
 */
function rollCalendar(rng: RNG): Wildcard[] {
    const beats = rng.nextInt(2, 4);
    const taken = new Set<WildcardKind>();
    const calendar: Wildcard[] = [];
    // Spread the scheduled (non-standing) beats across distinct days so two
    // never land on top of each other and leave the rest of the run empty.
    const usedDays = new Set<number>();

    for (let i = 0; i < beats; i++) {
        const def = drawWildcard(rng, taken);
        if (!def) break;
        taken.add(def.kind);
        if (def.kind === 'nothing') { calendar.push(materialise(def, rng)); continue; }

        const [from, to] = def.window;
        if (from === 0) { calendar.push(materialise(def, rng)); continue; }
        // Prefer a day nothing else is already scheduled on.
        let day = rng.nextInt(from, to);
        for (let attempt = 0; attempt < 6 && usedDays.has(day); attempt++) {
            day = rng.nextInt(from, to);
        }
        usedDays.add(day);
        calendar.push(materialise(def, rng, day));
    }

    // Standing conditions first (they are true from the gong), then by day.
    return calendar.sort((a, b) => a.day - b.day);
}

export function gamesProfileFor(seed: string): GamesProfile {
    const rng = new RNG(`${seed}-games-profile`);
    const calendar = rollCalendar(rng);
    return {
        // A Games number the player can refer to. Anchored well past the 75th so
        // a Quarter Quell wildcard is never contradicted by the arithmetic.
        gamesNumber: rng.nextInt(60, 140),
        temperament: rng.pick(GAMES_TEMPERAMENTS),
        // The headline the reaping announces. A scheduled beat makes a better
        // announcement than a standing condition, so it wins the billing.
        wildcard: calendar.find(w => w.day > 0) ?? calendar[0],
        calendar,
        castShape: rollCastShape(rng, calendar),
    };
}

/**
 * The config a run actually executes under: the player's settings, multiplied
 * by this year's temperament and by any standing wildcard condition.
 */
export function configForProfile(base: GameConfig, profile: GamesProfile): GameConfig {
    const t = profile.temperament;
    let sponsorGenerosity = base.sponsorGenerosity * t.sponsorGenerosity;
    let hazardRate = base.hazardRate * t.hazardRate;
    let betrayalRate = base.betrayalRate * t.betrayalRate;
    let enableFeast = base.enableFeast;

    // Every standing condition on the calendar applies, not just the headline
    // one — a run can be both a Quarter Quell and a sponsorship surge.
    for (const wildcard of calendarOf(profile)) {
        switch (wildcard.kind) {
            case 'no-feast': enableFeast = false; break;
            case 'sponsor-flood': sponsorGenerosity *= 1.7; break;
            case 'rule-change-no-allies': betrayalRate *= 2.5; break;
            case 'rule-change-allies': betrayalRate *= 0.5; break;
            case 'quarter-quell-doubled': hazardRate *= 1.6; break;
            case 'quarter-quell-pairs': betrayalRate *= 0.6; break;
            case 'crowd-revolt': hazardRate *= 1.3; break;
            default: break;
        }
    }

    return { ...base, sponsorGenerosity, hazardRate, betrayalRate, enableFeast };
}

/** The run's schedule, tolerating profiles saved before the calendar existed. */
export function calendarOf(profile: GamesProfile): Wildcard[] {
    return profile.calendar ?? (profile.wildcard ? [profile.wildcard] : []);
}

/** Standing conditions other systems ask about directly. */
export function wildcardIs(state: GameState, kind: WildcardKind): boolean {
    const profile = state.gamesProfile;
    if (!profile) return false;
    return calendarOf(profile).some(w => w.kind === kind);
}

/** How much earlier or later this year's border starts closing. */
export function escalationShift(state: GameState): number {
    return state.gamesProfile?.temperament.escalationShift ?? 0;
}

/** The Capitol's own summary of the year, for the reaping masthead. */
export function profileHeadline(profile: GamesProfile): string {
    return `The ${ordinal(profile.gamesNumber)} Hunger Games are ${profile.temperament.name}.`;
}

export function ordinal(n: number): string {
    const v = n % 100;
    if (v >= 11 && v <= 13) return `${n}th`;
    const suffixes = ['th', 'st', 'nd', 'rd'];
    return `${n}${suffixes[n % 10] ?? 'th'}`;
}
