import { GamemakerSignature, gamemakerProfile } from './gamemakers';

/**
 * AUDIT-11 §12: director personalities.
 *
 * Twenty named Head Gamemakers each had one signature turn and two
 * multipliers. A director taste is what they reach for the rest of the time:
 * weights on intervention choices the engine already makes — which unscheduled
 * disruption lands, which weather the booth dials up, how hungry the mutts are
 * once the arena is closing, how freely the sponsors are let through, how
 * readily alliances are allowed to rot. Every weight replaces a uniform pick
 * with a weighted one of the same draw count, so determinism holds and a
 * Games under a mutt-lover plays measurably unlike one under a sponsor-friend.
 */
export type DirectorTasteId =
    | 'mutt-lover'
    | 'fire-lover'
    | 'alliance-breaker'
    | 'weather-obsessed'
    | 'sponsor-friendly'
    | 'showrunner'
    | 'hands-off';

export interface DirectorTaste {
    id: DirectorTasteId;
    label: string;
    /** One line for the briefing. */
    blurb: string;
    /** Weight on mutt releases, and multiplier on escalated mutt odds. */
    mutts: number;
    /** Weight on heat and fire weather. */
    fire: number;
    /** Weight on every other weather front, and on unscheduled storms. */
    weather: number;
    /** Multiplier on the run's betrayal rate, and weight on crowd-turning disruptions. */
    betrayal: number;
    /** Multiplier on sponsor generosity, and weight on unscheduled supply drops. */
    sponsor: number;
}

/**
 * AUDIT-12 S3: tastes span 0.6–1.8 so each one moves its metric well clear of
 * run-to-run noise (the 0.95–1.15 band was invisible). AUDIT-12 S2: the
 * signature→taste map below no longer contradicts itself.
 */
const TASTES: Record<DirectorTasteId, DirectorTaste> = {
    'mutt-lover': {
        id: 'mutt-lover', label: 'mutt-lover',
        blurb: 'Releases mutts whenever there is an excuse; the closing arena is hungrier than usual.',
        mutts: 1.8, fire: 1, weather: 0.7, betrayal: 1, sponsor: 0.8,
    },
    'fire-lover': {
        id: 'fire-lover', label: 'fire-lover',
        blurb: 'When the booth reaches for the weather, it reaches for heat.',
        mutts: 1, fire: 1.8, weather: 0.7, betrayal: 1, sponsor: 1,
    },
    'alliance-breaker': {
        id: 'alliance-breaker', label: 'alliance-breaker',
        blurb: 'Packs are discouraged: betrayals come easier and the crowd is turned on its favourites.',
        mutts: 1, fire: 1, weather: 1, betrayal: 1.6, sponsor: 0.8,
    },
    'weather-obsessed': {
        id: 'weather-obsessed', label: 'weather-obsessed',
        blurb: 'Every unscheduled beat is a front; the climate budget is spent on purpose.',
        mutts: 0.8, fire: 1.2, weather: 1.8, betrayal: 1, sponsor: 1,
    },
    'sponsor-friendly': {
        id: 'sponsor-friendly', label: 'sponsor-friendly',
        blurb: 'Lets the parachutes through: sponsors are more generous and supply drops more common.',
        mutts: 0.7, fire: 1, weather: 0.8, betrayal: 0.8, sponsor: 1.7,
    },
    showrunner: {
        id: 'showrunner', label: 'showrunner',
        blurb: 'Wants set pieces: crowd-turning beats and bounties over quiet attrition.',
        mutts: 1.2, fire: 1.4, weather: 1, betrayal: 1.3, sponsor: 1,
    },
    'hands-off': {
        id: 'hands-off', label: 'hands-off',
        blurb: 'Intervenes as little as possible and lets the field do the work.',
        mutts: 0.6, fire: 0.8, weather: 0.6, betrayal: 1, sponsor: 1,
    },
};

const BY_SIGNATURE: Record<GamemakerSignature, DirectorTasteId> = {
    'release-mutts': 'mutt-lover',
    'cull-the-weak': 'fire-lover',
    'seal-the-horn': 'showrunner',
    'hunt-the-favourite': 'fire-lover',
    'punish-alliances': 'alliance-breaker',
    'call-a-truce': 'sponsor-friendly',
    'weather-front': 'weather-obsessed',
    'night-without-end': 'weather-obsessed',
    'poison-the-wells': 'alliance-breaker',
    'flood-the-low': 'weather-obsessed',
    'spare-the-young': 'sponsor-friendly',
    'arm-the-underdog': 'sponsor-friendly',
    'rig-the-feast': 'sponsor-friendly',
    'favour-a-district': 'showrunner',
    'call-the-feast': 'showrunner',
    'reveal-all': 'showrunner',
    'close-the-border': 'alliance-breaker',
    'do-nothing': 'hands-off',
    'grind': 'hands-off',
};

/** A neutral taste, for runs with no Head Gamemaker yet. */
export const NEUTRAL_TASTE: DirectorTaste = {
    id: 'hands-off', label: 'undeclared', blurb: '', mutts: 1, fire: 1, weather: 1, betrayal: 1, sponsor: 1,
};

/**
 * AUDIT-12 wave 3 S3 guard: `check-director-tastes` pins every director to one
 * taste (or to neutral) to measure it. Headless harnesses only — nothing in
 * the app sets it.
 */
let tasteOverride: DirectorTasteId | 'neutral' | undefined;
export function setDirectorTasteOverride(id: DirectorTasteId | 'neutral' | undefined): void {
    tasteOverride = id;
}

export const DIRECTOR_TASTE_IDS = Object.keys(TASTES) as DirectorTasteId[];

/** The taste of the named Head Gamemaker (neutral when none is appointed). */
export function directorTaste(headGamemaker: string | undefined): DirectorTaste {
    if (tasteOverride === 'neutral') return NEUTRAL_TASTE;
    if (tasteOverride) return TASTES[tasteOverride];
    if (!headGamemaker) return NEUTRAL_TASTE;
    return TASTES[BY_SIGNATURE[gamemakerProfile(headGamemaker).signature]];
}

/**
 * Weighted pick with exactly one draw — `u` is the one `nextFloat()` the
 * uniform pick it replaces would have consumed.
 */
export function weightedIndex(u: number, weights: number[]): number {
    const total = weights.reduce((s, w) => s + Math.max(0, w), 0);
    if (total <= 0) return Math.min(weights.length - 1, Math.floor(u * weights.length));
    let x = u * total;
    for (let i = 0; i < weights.length; i++) {
        x -= Math.max(0, weights[i]);
        if (x < 0) return i;
    }
    return weights.length - 1;
}
