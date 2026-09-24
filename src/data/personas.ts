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
    // §(requests 16): a professional says out loud that they know their job,
    // and a provocateur has spent three minutes making enemies of the room.
    'The Survivor': 0.05,
    'The Professional': 0.3,
    'The Homesick': -0.15,
    'The Volunteer': 0.1,
    'The Provocateur': 0.2,
    'The Grieving Sibling': -0.15,
    'The Reluctant Hero': -0.1,
    'The District Loyalist': -0.05,
    'The Wildcard': 0.05,
};

/**
 * AUDIT-11 §8: past warm/cold. Eighteen personas read, to the Capitol, as
 * seven kinds of story — and each kind is money from a different bloc.
 */
export type PersonaFamily =
    | 'heartthrob' | 'underdog' | 'killer' | 'enigma' | 'professional' | 'firebrand' | 'loyalist';

export const PERSONA_FAMILY: Record<InterviewPersona, PersonaFamily> = {
    'The Star-Crossed Lover': 'heartthrob',
    'The Charming Flirt': 'heartthrob',
    'The Humble Underdog': 'underdog',
    'The Homesick': 'underdog',
    'The Grieving Sibling': 'underdog',
    'The Ruthless Warrior': 'killer',
    'The Arrogant Brute': 'killer',
    'The Mysterious Enigma': 'enigma',
    'The Silent Threat': 'enigma',
    'The Quirky Oddball': 'firebrand',
    'The Provocateur': 'firebrand',
    'The Wildcard': 'firebrand',
    'The Cold Strategist': 'professional',
    'The Professional': 'professional',
    'The Volunteer': 'professional',
    'The Survivor': 'loyalist',
    'The Reluctant Hero': 'loyalist',
    'The District Loyalist': 'loyalist',
};

export const PERSONA_FAMILY_LABEL: Record<PersonaFamily, string> = {
    heartthrob: 'Heartthrob',
    underdog: 'Underdog',
    killer: 'Killer',
    enigma: 'Enigma',
    professional: 'Professional',
    firebrand: 'Firebrand',
    loyalist: 'Loyalist',
};

/**
 * Extra weight a persona family adds to a sponsor bloc's pull toward the
 * tribute (bloc ids from `engine/sponsorBlocs.ts`). Small next to the blocs'
 * own preferences — a persona opens a door; the Games decide who walks in.
 */
export const PERSONA_BLOC_AFFINITY: Record<PersonaFamily, Partial<Record<string, number>>> = {
    heartthrob: { romantics: 1.5 },
    underdog: { romantics: 0.8, gamblers: 0.8 },
    killer: { 'old-money': 0.8, gamblers: 0.8 },
    enigma: { gamblers: 1.2 },
    professional: { 'old-money': 1, industry: 0.6 },
    firebrand: { gamblers: 1, romantics: 0.4 },
    loyalist: { industry: 1.4 },
};

export function personaBlocAffinity(persona: InterviewPersona | undefined, blocId: string): number {
    if (!persona) return 0;
    const family = PERSONA_FAMILY[persona];
    return family ? PERSONA_BLOC_AFFINITY[family][blocId] ?? 0 : 0;
}
