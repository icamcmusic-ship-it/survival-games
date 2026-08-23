import { Stance } from '../models/types';

/**
 * A1: the stance roster, as data.
 *
 * `updateStance` used to build `const scores: Record<Stance, number>` with all
 * three literal keys and a block of hand-written scoring rows per stance, so
 * adding a stance meant editing control flow in three files. The roster, the
 * families and the per-stance hold now live here; the scoring rows live in a
 * `STANCE_SCORERS` table in `engine/stance.ts`. Adding a ninth stance is a
 * data row in each — the same refactor the archetype weights already got.
 */

/**
 * Which of the original three a stance behaves like at legacy read sites.
 *
 * Every `t.stance === 'Aggressive'` check in the engine predates the extended
 * roster and means "are they pressing" rather than "are they in this exact
 * stance". Mapping through the family keeps all of those correct — a Hunting
 * tribute is loud and looking, a Fortified one is dug in — without auditing
 * forty read sites for each new stance.
 */
export type StanceFamily = 'aggressive' | 'defensive' | 'evasive';

export interface StanceProfile {
    id: Stance;
    label: string;
    family: StanceFamily;
    /**
     * True for the five stances that are only reachable under a specific
     * situation. Conditional stances are filtered out of the ranking before
     * the hysteresis compare, which is what stops Fortified/Desperate from
     * thrashing on the cycle their precondition flickers.
     */
    conditional: boolean;
    /**
     * Minimum cycles held before this stance may be replaced. Gated per stance
     * rather than globally: Desperate is an emergency and holds for nothing,
     * Fortified is a commitment and holds for three.
     */
    minHold: number;
    /** One line, shown on the tribute sheet. */
    blurb: string;
}

export const STANCE_PROFILES: Record<Stance, StanceProfile> = {
    Aggressive: {
        id: 'Aggressive', label: 'Aggressive', family: 'aggressive',
        conditional: false, minHold: 3,
        blurb: 'Sweeping the zone, initiating, looking for someone to find.',
    },
    Defensive: {
        id: 'Defensive', label: 'Defensive', family: 'defensive',
        conditional: false, minHold: 3,
        blurb: 'Holding ground: forages, rests, and retreats cheaply.',
    },
    Evasive: {
        id: 'Evasive', label: 'Evasive', family: 'evasive',
        conditional: false, minHold: 3,
        blurb: 'Outmatched or hurt. Hides, and heals if nobody finds them.',
    },
    Hunting: {
        id: 'Hunting', label: 'Hunting', family: 'aggressive',
        conditional: true, minHold: 2,
        blurb: 'Working a specific person. Crosses ground fast and ambushes well, but travels loud.',
    },
    Fortified: {
        id: 'Fortified', label: 'Fortified', family: 'defensive',
        conditional: true, minHold: 3,
        blurb: 'Dug in on ground they chose. Cannot be ambushed; their traps bite harder; moving costs double.',
    },
    Desperate: {
        id: 'Desperate', label: 'Desperate', family: 'aggressive',
        conditional: true, minHold: 0,
        blurb: 'Past caring. Will not retreat, hits harder, sees less, and will rob an ally.',
    },
    Scavenging: {
        id: 'Scavenging', label: 'Scavenging', family: 'defensive',
        conditional: true, minHold: 2,
        blurb: 'Working the ground others left: cannon sites, stripped zones, bodies.',
    },
    Shadowing: {
        id: 'Shadowing', label: 'Shadowing', family: 'evasive',
        conditional: true, minHold: 2,
        blurb: 'One zone behind someone who has not noticed. Three quiet cycles buys a free ambush.',
    },
};

/** Every stance, in display order. The single source of truth for iteration. */
export const STANCES: Stance[] = Object.keys(STANCE_PROFILES) as Stance[];

/** The three always-available stances. */
export const CORE_STANCES: Stance[] = STANCES.filter(s => !STANCE_PROFILES[s].conditional);

export function stanceFamily(stance: Stance): StanceFamily {
    return STANCE_PROFILES[stance]?.family ?? 'defensive';
}

/** True when the stance presses: hunts, initiates, and is loud doing it. */
export function isAggressiveStance(stance: Stance): boolean {
    return stanceFamily(stance) === 'aggressive';
}

/** True when the stance is trying not to be found. */
export function isEvasiveStance(stance: Stance): boolean {
    return stanceFamily(stance) === 'evasive';
}

/** True when the stance holds position and works the ground it is on. */
export function isDefensiveStance(stance: Stance): boolean {
    return stanceFamily(stance) === 'defensive';
}

/** Guards a save written before the roster expanded. */
export function isKnownStance(value: unknown): value is Stance {
    return typeof value === 'string' && value in STANCE_PROFILES;
}
