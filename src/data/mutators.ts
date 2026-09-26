import { GameConfig } from '../models/types';
import { RNG } from '../utils/rng';

/**
 * AUDIT-11 §12: the mutators deck. Two cards per Games, chosen or drawn at
 * setup, stored on `GameConfig.mutators` — so a share link, a save and a
 * replay all carry them — and shown on the run profile. Older configs have
 * none, which is the ordinary Games.
 */
export type MutatorId =
    | 'no-cornucopia'
    | 'double-feasts'
    | 'blind-night'
    | 'all-volunteer'
    | 'sponsor-drought'
    | 'hazard-storm'
    // AUDIT-12 wave 3 §11: the deck grows from six to fourteen.
    | 'mutts-only-kills'
    | 'water-ration'
    | 'one-way-edges'
    | 'silent-cannons'
    | 'no-night'
    | 'wounded-start'
    | 'sponsor-auction'
    | 'border-doubles';

export interface Mutator {
    id: MutatorId;
    name: string;
    blurb: string;
    /** AUDIT-12 wave 3: how much harder the card makes a Games to call, for gauntlet scoring. */
    difficulty?: number;
}

export const MUTATORS: Mutator[] = [
    { id: 'no-cornucopia', name: 'No Cornucopia', blurb: 'The horn holds scraps: no weapons, nothing worth more than a meal.' },
    { id: 'double-feasts', name: 'Double feasts', blurb: 'The Gamemakers may call twice as many feasts, and call them more readily.' },
    { id: 'blind-night', name: 'Blind night', blurb: 'Nights are pitch black: hiding is easier and ambushes land harder, torch or not.' },
    { id: 'all-volunteer', name: 'All-volunteer', blurb: 'Every name read out is answered by a volunteer.' },
    { id: 'sponsor-drought', name: 'Sponsor drought', blurb: 'The Capitol’s purses are nearly shut: sponsor generosity x0.4.' },
    { id: 'hazard-storm', name: 'Hazard storm', blurb: 'The arena is angrier than usual: hazard rate x1.6.' },
    { id: 'mutts-only-kills', name: 'Mutts only', blurb: 'Only the mutts\u2019 kills count with the crowd: a tribute who kills is booed, and the arena lets more mutts loose.', difficulty: 3 },
    { id: 'water-ration', name: 'Water ration', blurb: 'Every cycle is thirstier than the last; the springs are metered.', difficulty: 2 },
    { id: 'one-way-edges', name: 'One-way roads', blurb: 'Every route runs one way: there is no walking back the way you came.', difficulty: 2 },
    { id: 'silent-cannons', name: 'Silent cannons', blurb: 'No cannon, no faces in the sky: nobody knows who is still alive.', difficulty: 2 },
    { id: 'no-night', name: 'No night', blurb: 'The arena lights never go down; there is no dark to hide in or sleep through.', difficulty: 2 },
    { id: 'wounded-start', name: 'Wounded start', blurb: 'Every tribute rises on the plate already hurt.', difficulty: 3 },
    { id: 'sponsor-auction', name: 'Sponsor auction', blurb: 'Every parachute is bid for: the blocs outbid each other, and the purses empty fast.', difficulty: 1 },
    { id: 'border-doubles', name: 'Border doubles', blurb: 'The border closes early, and every closing sends a second pulse through the zones beside it.', difficulty: 3 },
];

/** AUDIT-12 wave 3: gauntlet difficulty of the original six (the new cards carry their own). */
const LEGACY_DIFFICULTY: Partial<Record<MutatorId, number>> = {
    'no-cornucopia': 2, 'double-feasts': 1, 'blind-night': 2, 'all-volunteer': 1, 'sponsor-drought': 2, 'hazard-storm': 3,
};

export function mutatorDifficulty(id: string): number {
    const m = MUTATORS.find(x => x.id === id);
    return m?.difficulty ?? LEGACY_DIFFICULTY[id as MutatorId] ?? 1;
}

/**
 * AUDIT-12 wave 3 §11: cards that cannot share a Games — one would cancel or
 * contradict the other. Symmetric; checked by the draw, the parser, the save
 * reader and the setup screen.
 */
export const MUTATOR_INCOMPATIBLE: ReadonlyArray<readonly [MutatorId, MutatorId, string]> = [
    ['no-night', 'blind-night', 'There is no night for the blind night to fall on.'],
    ['sponsor-drought', 'sponsor-auction', 'An auction needs purses; the drought has shut them.'],
    ['sponsor-drought', 'double-feasts', 'A drought year does not lay two tables.'],
    ['silent-cannons', 'mutts-only-kills', 'A crowd that cannot hear the cannon cannot score the kills.'],
    ['water-ration', 'hazard-storm', 'Two ways of killing the field with the ground: the Capitol picks one.'],
    ['one-way-edges', 'border-doubles', 'A one-way map with a doubled border strands the field before day three.'],
];

/** Why two cards cannot share a Games, or undefined when they can. */
export function mutatorConflict(a: string, b: string): string | undefined {
    const hit = MUTATOR_INCOMPATIBLE.find(([x, y]) => (x === a && y === b) || (x === b && y === a));
    return hit?.[2];
}

/** Drops any card that conflicts with one already kept, and duplicates; keeps order. */
export function compatibleMutators(ids: readonly string[], max = MUTATORS_PER_GAMES): string[] {
    const out: string[] = [];
    ids.forEach(id => {
        if (out.length >= max || out.includes(id) || !MUTATORS.some(m => m.id === id)) return;
        if (out.some(k => mutatorConflict(k, id))) return;
        out.push(id);
    });
    return out;
}

export const MUTATORS_PER_GAMES = 2;
/** AUDIT-12 wave 3: a gauntlet stacks up to this many. */
export const GAUNTLET_MAX_MUTATORS = 4;

/** How many cards a config may carry. */
export function mutatorCap(config: { gauntlet?: boolean } | undefined): number {
    return config?.gauntlet ? GAUNTLET_MAX_MUTATORS : MUTATORS_PER_GAMES;
}

/** Tuning for the mutators that change the simulation's numbers. */
export const MUTATOR_TUNING = {
    /** Horn items at or under this value survive `no-cornucopia`. */
    noCornucopiaMaxValue: 15,
    feastMultiplier: 2,
    blindNightConcealment: 0.15,
    blindNightAmbush: 0.1,
    sponsorDrought: 0.4,
    hazardStorm: 1.6,
};

export function hasMutator(config: Pick<GameConfig, 'mutators'> | undefined, id: MutatorId): boolean {
    return config?.mutators?.includes(id) ?? false;
}

/**
 * Deterministic draw of `count` distinct, mutually compatible cards from a
 * seed. AUDIT-12 wave 3: a card that conflicts with one already drawn is
 * discarded and the draw continues.
 */
export function drawMutators(seed: string, count: number = MUTATORS_PER_GAMES): MutatorId[] {
    const rng = new RNG(`${seed}-mutators`);
    const pool = MUTATORS.map(m => m.id);
    const out: MutatorId[] = [];
    while (out.length < count && pool.length > 0) {
        const id = pool.splice(rng.nextInt(0, pool.length - 1), 1)[0];
        if (out.some(k => mutatorConflict(k, id))) continue;
        out.push(id);
    }
    return out;
}

export function mutatorName(id: string): string {
    return MUTATORS.find(m => m.id === id)?.name ?? id;
}

/** Parse a comma list (share link) into known mutator ids; empty -> undefined. */
export function parseMutators(raw: string | null | undefined, max: number = MUTATORS_PER_GAMES): string[] | undefined {
    if (!raw) return undefined;
    // AUDIT-12 S5: de-duplicated, so `blind-night,blind-night` is one card.
    // AUDIT-12 wave 3: and an incompatible pair keeps only the first.
    const ids = compatibleMutators(raw.split(','), max);
    return ids.length > 0 ? ids : undefined;
}

/**
 * AUDIT-12 wave 3: the arena laws some cards are. A card that is a law reads
 * through `arenaHasLaw`, so every system that already honours the law honours
 * the card with no second code path.
 */
const MUTATOR_LAWS: Partial<Record<MutatorId, string>> = {
    'no-night': 'noNight',
    'silent-cannons': 'noCannons',
    'one-way-edges': 'oneWayBorders',
};

export function mutatorGrantsLaw(config: Pick<GameConfig, 'mutators'> | undefined, law: string): boolean {
    return (config?.mutators ?? []).some(id => MUTATOR_LAWS[id as MutatorId] === law);
}
