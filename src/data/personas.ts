import { InterviewPersona } from '../models/types';
import { INTERVIEW_SCENARIOS } from './flavorText';

/**
 * §1.7: the bridge between the persona union and the flavour table.
 *
 * `Tribute.interviewStrategy` used to be a bare `string` compared against
 * thirteen string literals across three files. A typo in `INTERVIEW_SCENARIOS`
 * produced a persona that matched nothing — no threat weighting in the
 * bloodbath, no alliance chemistry, and no error anywhere. The union in
 * `models/types.ts` now types the field; this module is where the two lists
 * are checked against each other, at build time.
 */

/** Every persona, in the order the interview table declares them. */
export const INTERVIEW_PERSONAS: InterviewPersona[] =
    INTERVIEW_SCENARIOS.map(s => s.strategy as InterviewPersona);

/**
 * Compile-time assertion that the flavour table declares exactly the personas
 * the union names. `strategy` is widened to `string` by the table's inferred
 * type, so this cast is the check: if a table entry names a persona the union
 * does not, `INTERVIEW_PERSONAS` still type-checks — but the reverse map below
 * fails to compile, because a `Record<InterviewPersona, …>` cannot be built
 * from a list missing one of its keys.
 */
const DECLARED: Record<InterviewPersona, true> = {
    'The Star-Crossed Lover': true,
    'The Ruthless Warrior': true,
    'The Humble Underdog': true,
    'The Mysterious Enigma': true,
    'The Charming Flirt': true,
    'The Arrogant Brute': true,
    'The Quirky Oddball': true,
    'The Silent Threat': true,
    'The Grieving Sibling': true,
    'The Cold Strategist': true,
    'The Reluctant Hero': true,
    'The District Loyalist': true,
    'The Wildcard': true,
};

/** Guards a string of unknown provenance — a save, a URL, a coaching pin. */
export function isInterviewPersona(value: unknown): value is InterviewPersona {
    return typeof value === 'string' && value in DECLARED;
}

/** Personas the crowd reads as warm, and the ones it reads as cold. */
export const WARM_PERSONAS: InterviewPersona[] = [
    'The Star-Crossed Lover', 'The Humble Underdog', 'The Charming Flirt',
    'The Quirky Oddball', 'The Grieving Sibling', 'The Reluctant Hero',
    'The District Loyalist',
];

export const COLD_PERSONAS: InterviewPersona[] = [
    'The Ruthless Warrior', 'The Arrogant Brute', 'The Mysterious Enigma',
    'The Silent Threat', 'The Cold Strategist',
];

/**
 * How much of a priority target each persona makes a tribute in the bloodbath.
 * A `Record` rather than a `switch`: a persona added to the union without a
 * weighting is now a compile error rather than a silent zero.
 */
export const PERSONA_THREAT: Record<InterviewPersona, number> = {
    'The Ruthless Warrior': 0.35,
    'The Arrogant Brute': 0.3,
    'The Mysterious Enigma': 0.15,
    'The Star-Crossed Lover': -0.1,
    'The Humble Underdog': -0.15,
    'The Charming Flirt': -0.05,
    'The Quirky Oddball': -0.05,
    'The Silent Threat': 0.25,
    'The Cold Strategist': 0.2,
    'The Grieving Sibling': -0.15,
    'The Reluctant Hero': -0.1,
    'The District Loyalist': -0.05,
    'The Wildcard': 0.05,
};
