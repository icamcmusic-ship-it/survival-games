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
    | 'hazard-storm';

export interface Mutator {
    id: MutatorId;
    name: string;
    blurb: string;
}

export const MUTATORS: Mutator[] = [
    { id: 'no-cornucopia', name: 'No Cornucopia', blurb: 'The horn holds scraps: no weapons, nothing worth more than a meal.' },
    { id: 'double-feasts', name: 'Double feasts', blurb: 'The Gamemakers may call twice as many feasts, and call them more readily.' },
    { id: 'blind-night', name: 'Blind night', blurb: 'Nights are pitch black: hiding is easier and ambushes land harder, torch or not.' },
    { id: 'all-volunteer', name: 'All-volunteer', blurb: 'Every name read out is answered by a volunteer.' },
    { id: 'sponsor-drought', name: 'Sponsor drought', blurb: 'The Capitol’s purses are nearly shut: sponsor generosity x0.4.' },
    { id: 'hazard-storm', name: 'Hazard storm', blurb: 'The arena is angrier than usual: hazard rate x1.6.' },
];

export const MUTATORS_PER_GAMES = 2;

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

/** Deterministic draw of `MUTATORS_PER_GAMES` distinct cards from a seed. */
export function drawMutators(seed: string): MutatorId[] {
    const rng = new RNG(`${seed}-mutators`);
    const pool = MUTATORS.map(m => m.id);
    const out: MutatorId[] = [];
    while (out.length < MUTATORS_PER_GAMES && pool.length > 0) {
        out.push(pool.splice(rng.nextInt(0, pool.length - 1), 1)[0]);
    }
    return out;
}

export function mutatorName(id: string): string {
    return MUTATORS.find(m => m.id === id)?.name ?? id;
}

/** Parse a comma list (share link) into known mutator ids; empty -> undefined. */
export function parseMutators(raw: string | null | undefined): string[] | undefined {
    if (!raw) return undefined;
    const ids = raw.split(',').filter(id => MUTATORS.some(m => m.id === id)).slice(0, MUTATORS_PER_GAMES);
    return ids.length > 0 ? ids : undefined;
}
