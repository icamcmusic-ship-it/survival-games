import { GameConfig, GameState } from '../models/types';
import { RNG } from '../utils/rng';
import {
    CAST_SHAPES, CastShape, CastShapeId, GAMES_TEMPERAMENTS, GamesTemperament,
    Wildcard, WildcardDef, WILDCARDS, WildcardKind,
} from '../data/gamesProfile';
import { GAMES_MODIFIERS, ModifierId } from '../data/modifiers';
import { MODIFIERS, RARITY_WEIGHT } from '../data/balance';

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
    /**
     * §10.2: standing format changes, 1-3 per run, orthogonal to everything
     * above. Optional so profiles rolled before modifiers existed still load.
     */
    modifiers?: ModifierId[];
}

/**
 * §10.2: this year's format changes.
 *
 * Drawn by weight, respecting each modifier's exclusions, and deliberately
 * allowed to come out empty — a conventional year is itself one of the
 * outcomes, and it has to stay common enough that an unconventional one reads
 * as unusual.
 */
function rollModifiers(rng: RNG): ModifierId[] {
    // Most years get one; a minority get two or three, which is where the
    // genuinely strange combinations live.
    const count = rng.chance(MODIFIERS.threeChance) ? 3
        : rng.chance(MODIFIERS.twoChance) ? 2
            : rng.chance(MODIFIERS.oneChance) ? 1
                : 0;
    const chosen: ModifierId[] = [];
    const barred = new Set<ModifierId>();

    for (let i = 0; i < count; i++) {
        const pool = GAMES_MODIFIERS.filter(m => !chosen.includes(m.id) && !barred.has(m.id));
        if (pool.length === 0) break;
        const total = pool.reduce((sum, m) => sum + m.weight, 0);
        let roll = rng.nextFloat() * total;
        let picked = pool[pool.length - 1];
        for (const m of pool) {
            roll -= m.weight;
            if (roll <= 0) { picked = m; break; }
        }
        chosen.push(picked.id);
        picked.excludes?.forEach(id => barred.add(id));
        // Exclusion is symmetric: whatever bars this one, this one bars back.
        GAMES_MODIFIERS.filter(m => m.excludes?.includes(picked.id)).forEach(m => barred.add(m.id));
    }
    return chosen;
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
    // §10.2: rarity tiers on top of weight. A flat weighted pool meant a
    // player who had watched twenty runs had seen effectively everything the
    // schedule could do; the rare beats need to stay rare enough that meeting
    // one is still worth telling somebody about.
    const rarityFactor = (rarity: WildcardDef['rarity']) =>
        rarity === 'legendary' ? RARITY_WEIGHT.legendary
            : rarity === 'uncommon' ? RARITY_WEIGHT.uncommon
                : RARITY_WEIGHT.common;
    const effective = (w: WildcardDef) => w.weight * rarityFactor(w.rarity);
    const total = pool.reduce((sum, w) => sum + effective(w), 0);
    let roll = rng.nextFloat() * total;
    let chosen = pool[pool.length - 1];
    for (const w of pool) {
        roll -= effective(w);
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
    const modifiers = rollModifiers(rng);
    const castShape = rollCastShape(rng, calendar);
    return {
        // A Games number the player can refer to. Anchored well past the 75th so
        // a Quarter Quell wildcard is never contradicted by the arithmetic.
        gamesNumber: rng.nextInt(60, 140),
        temperament: rng.pick(GAMES_TEMPERAMENTS),
        // The headline the reaping announces. A scheduled beat makes a better
        // announcement than a standing condition, so it wins the billing.
        wildcard: calendar.find(w => w.day > 0) ?? calendar[0],
        calendar,
        // §10.2: an all-volunteer year is a property of the reaping, so it
        // is folded into the cast shape rather than checked at a dozen call
        // sites. Cloned — CAST_SHAPES is a shared table.
        castShape: modifiers.includes('all-volunteer')
            ? { ...castShape, volunteerChance: 1 }
            : castShape,
        modifiers,
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

    // §10.2: format changes sit on top of everything the calendar did.
    for (const id of profile.modifiers ?? []) {
        switch (id) {
            case 'no-sponsors': sponsorGenerosity = 0; break;
            case 'no-mentors': sponsorGenerosity *= MODIFIERS.noMentorsGenerosity; break;
            case 'rich-arena': sponsorGenerosity *= MODIFIERS.richGenerosity; break;
            case 'no-feast': enableFeast = false; break;
            case 'doubled-mutts': hazardRate *= MODIFIERS.doubledMuttHazard; break;
            case 'half-arena': hazardRate *= MODIFIERS.halfArenaHazard; break;
            default: break;
        }
    }

    return { ...base, sponsorGenerosity, hazardRate, betrayalRate, enableFeast };
}

/** The run's schedule, tolerating profiles saved before the calendar existed. */
export function calendarOf(profile: GamesProfile): Wildcard[] {
    return profile.calendar ?? (profile.wildcard ? [profile.wildcard] : []);
}

/** §10.2: whether this year's format carries a given modifier. */
export function hasModifier(state: GameState, id: ModifierId): boolean {
    return (state.gamesProfile?.modifiers ?? []).includes(id);
}

/** Standing conditions other systems ask about directly. */
export function wildcardIs(state: GameState, kind: WildcardKind): boolean {
    const profile = state.gamesProfile;
    if (!profile) return false;
    return calendarOf(profile).some(w => w.kind === kind);
}

/**
 * §10.2: format changes that move the collapse schedule.
 *
 * A year with no feast has had its main convergence event removed, so the
 * Gamemakers close the arena earlier to compensate — otherwise "no feast"
 * quietly reads as "no ending", which is what it measured as.
 */
export function modifierEscalationShift(state: GameState): number {
    let shift = 0;
    if (hasModifier(state, 'no-feast')) shift += MODIFIERS.noFeastShift;
    if (hasModifier(state, 'sudden-death')) shift += MODIFIERS.suddenDeathShift;
    return shift;
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
