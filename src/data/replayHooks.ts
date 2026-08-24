import { GameConfig } from '../models/types';
import { ARENAS, DEFAULT_GAME_CONFIG } from './constants';
import { RNG } from '../utils/rng';

/**
 * §10: the replayability layer — three things built entirely on top of
 * infrastructure that already exists, and no new mechanics at all.
 *
 * The problem they solve is the one a deep simulation always has: it can
 * produce far more variety than any individual player will ever go looking
 * for. A player with a favourite preset and a favourite arena has, in effect,
 * a much smaller game than the one that shipped, and nothing was pointing them
 * anywhere else.
 */

/**
 * §10.1: the shared daily seed.
 *
 * Personal seeds already exist and already replay exactly, which is the whole
 * of the infrastructure a daily needs: derive one string from the date and
 * everybody in the world is watching the same cast in the same arena on the
 * same day, and can compare what happened. The same category of feature as a
 * daily puzzle, built on plumbing that was already here.
 *
 * Deliberately UTC: a daily that rolls over at a different moment for two
 * people is not a shared daily.
 */
export function dailySeed(now: Date = new Date()): string {
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    return `daily-${y}-${m}-${d}`;
}

/** The arena the daily runs in — fixed for the day, same for everybody. */
export function dailyArenaId(seed: string = dailySeed()): string {
    return new RNG(`${seed}-arena`).pick([...ARENAS.map(a => a.id), 'procedural']);
}

/**
 * §10.2: mutator bundles.
 *
 * Curated combinations of the *existing* sliders, surfaced as named
 * quick-toggles. Nothing here is a new mechanic — every one of them is a
 * configuration a player could already have hand-assembled, which is precisely
 * the point: a player chasing variety should not have to reconstruct a spicy
 * combination from the full slider set every single time.
 *
 * Distinct from the presets, which are the four coherent *default* shapes a
 * Games comes in. A mutator is deliberately lopsided.
 */
export interface Mutator {
    id: string;
    name: string;
    blurb: string;
    config: Partial<GameConfig>;
}

export const MUTATORS: Mutator[] = [
    {
        id: 'famine',
        name: 'Famine Year',
        blurb: 'No feast, no sponsors worth the name, and an arena that is not helping. Everything comes down to what is on the ground.',
        config: { enableFeast: false, sponsorGenerosity: 0.25, hazardRate: 1.4 },
    },
    {
        id: 'knives-out',
        name: 'Knives Out',
        blurb: 'Alliances form and then do not last. A year about who turns on whom, rather than about the arena.',
        config: { betrayalRate: 3.0, hazardRate: 0.6, sponsorGenerosity: 1.5 },
    },
    {
        id: 'patrons-year',
        name: 'The Patrons\' Year',
        blurb: 'The Capitol is paying attention and paying for it. Parachutes constantly, and a field that lives long enough to use them.',
        config: { sponsorGenerosity: 3.0, hazardRate: 0.5, betrayalRate: 0.5, enableFeast: true },
    },
    {
        id: 'the-grinder',
        name: 'The Grinder',
        blurb: 'Sixteen districts, everything dialled up, nobody coming to help. The largest and least survivable Games available.',
        config: { districtCount: 16, hazardRate: 2.5, betrayalRate: 2.0, sponsorGenerosity: 0.5 },
    },
    {
        id: 'clear-heads',
        name: 'Clear Heads',
        blurb: 'Sanity off and betrayal low: a year decided by fighting, foraging and the arena, with the psychology taken out of it.',
        config: { enableSanity: false, betrayalRate: 0.4, hazardRate: 1.6 },
    },
    {
        id: 'two-hander',
        name: 'Two-Hander',
        blurb: 'Two districts, four tributes, nowhere to hide from each other. Over fast and almost entirely personal.',
        config: { districtCount: 2, hazardRate: 1.2, betrayalRate: 1.5, enableFeast: false },
    },
];

export function applyMutator(config: GameConfig, mutator: Mutator): GameConfig {
    return { ...config, ...mutator.config };
}

/** True when every field the mutator sets currently matches. */
export function mutatorActive(config: GameConfig, mutator: Mutator): boolean {
    return (Object.keys(mutator.config) as Array<keyof GameConfig>)
        .every(k => config[k] === mutator.config[k]);
}

/**
 * §10.3: the featured arena.
 *
 * Rotates daily, and prefers an arena this player has not run. The point is
 * to keep a 40-arena roster from collapsing into everybody's same five
 * favourites, and it is directly useful for finishing the
 * `meta-every-biome`-style achievements — which ask a player to go somewhere
 * new and then give them no help at all finding out where they have not been.
 *
 * `seenNames` is `panem.arenasSeen`, which keys hand-authored arenas by
 * display name.
 */
export function featuredArena(seenNames: string[], now: Date = new Date()): { id: string; name: string; unseen: boolean } {
    const rng = new RNG(`${dailySeed(now)}-featured`);
    const seen = new Set(seenNames);
    const unplayed = ARENAS.filter(a => !seen.has(a.name));
    // Somewhere new if there is anywhere new; otherwise just somewhere, so the
    // slot never goes empty for a player who has run everything.
    const pool = unplayed.length > 0 ? unplayed : ARENAS;
    const pick = rng.pick(pool);
    return { id: pick.id, name: pick.name, unseen: unplayed.length > 0 };
}

/** The config a daily run uses, so everybody's daily is genuinely the same. */
export function dailyConfig(): GameConfig {
    return { ...DEFAULT_GAME_CONFIG };
}
