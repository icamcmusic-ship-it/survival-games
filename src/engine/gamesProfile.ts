import { GameConfig, GameState } from '../models/types';
import { RNG } from '../utils/rng';
import {
    GAMES_TEMPERAMENTS, GamesTemperament, Wildcard, WILDCARDS, WildcardKind,
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
    wildcard: Wildcard;
}

/** Weighted draw from the wildcard pool. */
function rollWildcard(rng: RNG): Wildcard {
    const total = WILDCARDS.reduce((sum, w) => sum + w.weight, 0);
    let roll = rng.nextFloat() * total;
    let chosen = WILDCARDS[WILDCARDS.length - 1];
    for (const w of WILDCARDS) {
        roll -= w.weight;
        if (roll <= 0) { chosen = w; break; }
    }
    const [from, to] = chosen.window;
    return {
        kind: chosen.kind,
        name: chosen.name,
        announcement: chosen.announcement,
        onFire: chosen.onFire,
        day: from === 0 ? 0 : rng.nextInt(from, to),
    };
}

export function gamesProfileFor(seed: string): GamesProfile {
    const rng = new RNG(`${seed}-games-profile`);
    return {
        // A Games number the player can refer to. Anchored well past the 75th so
        // a Quarter Quell wildcard is never contradicted by the arithmetic.
        gamesNumber: rng.nextInt(60, 140),
        temperament: rng.pick(GAMES_TEMPERAMENTS),
        wildcard: rollWildcard(rng),
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

    switch (profile.wildcard.kind) {
        case 'no-feast': enableFeast = false; break;
        case 'sponsor-flood': sponsorGenerosity *= 1.7; break;
        case 'rule-change-no-allies': betrayalRate *= 2.5; break;
        case 'rule-change-allies': betrayalRate *= 0.5; break;
        case 'quarter-quell-doubled': hazardRate *= 1.6; break;
        case 'quarter-quell-pairs': betrayalRate *= 0.6; break;
        case 'crowd-revolt': hazardRate *= 1.3; break;
        default: break;
    }

    return { ...base, sponsorGenerosity, hazardRate, betrayalRate, enableFeast };
}

/** Standing conditions other systems ask about directly. */
export function wildcardIs(state: GameState, kind: WildcardKind): boolean {
    return state.gamesProfile?.wildcard.kind === kind;
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
