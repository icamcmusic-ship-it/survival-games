import { Phase } from '../models/types';

/**
 * UX-16: what the audience is actually allowed to know, and when.
 *
 * The reaping screen promised that "only age, height and build are public —
 * everything else they will have to show you in the arena", and then the very
 * next screen printed exact attributes, archetype and every trait before
 * training had even happened. The dramatic beat was undercut one click later.
 *
 * The engine now models imperfect information properly — `assessZone` reads a
 * stranger's frame, visible weapon and reputation rather than their sheet — so
 * a fully omniscient audience is the remaining inconsistency. This commits to
 * the fog: information arrives when the Capitol would actually broadcast it.
 *
 *   reaping/setup  — public record only: district, gender, age, height, build.
 *   training       — the Gamemakers publish scores, and their assessment of
 *                    what kind of tribute this is. Attributes read as bands.
 *   interviews     — Caesar puts them on a couch. Charisma and traits come out.
 *   in the arena   — you are watching them. Everything is visible.
 */
export type Disclosure = 'public' | 'scored' | 'interviewed' | 'open';

export function disclosureFor(phase: Phase): Disclosure {
    switch (phase) {
        case 'reaping':
        case 'setup':
        case 'roster':
            return 'public';
        case 'training':
            return 'scored';
        case 'interviews':
            return 'interviewed';
        default:
            return 'open';
    }
}

export const canSeeArchetype = (d: Disclosure) => d !== 'public';
export const canSeeTraits = (d: Disclosure) => d === 'interviewed' || d === 'open';
export const canSeeExactAttributes = (d: Disclosure) => d === 'open';
export const canSeeAttributeBands = (d: Disclosure) => d !== 'public';
/** A "Random Arena" pick at setup: the identity stays sealed until the Games actually begin. */
export const canSeeArena = (d: Disclosure) => d === 'open';

/**
 * An attribute as the Capitol reports it before the gong: a band, not a number.
 * Deliberately coarse — the whole point is that two tributes who both read
 * "Strong" can still be a long way apart.
 */
export function attributeBand(value: number): { label: string; filled: number } {
    if (value >= 9) return { label: 'Exceptional', filled: 5 };
    if (value >= 7) return { label: 'Strong', filled: 4 };
    if (value >= 5) return { label: 'Average', filled: 3 };
    if (value >= 3) return { label: 'Weak', filled: 2 };
    return { label: 'Poor', filled: 1 };
}

/** Why a given field is hidden, for the tooltip on a sealed value. */
export function sealedReason(d: Disclosure): string {
    if (d === 'public') return 'Sealed until the Gamemakers publish training scores.';
    if (d === 'scored') return 'Sealed until the interviews.';
    return 'Sealed until the Games begin.';
}
