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
    Nursing: {
        id: 'Nursing', label: 'Nursing', family: 'defensive',
        conditional: true, minHold: 2,
        blurb: 'Standing over a hurt ally. Staunches and settles them each cycle; goes nowhere and hunts nothing.',
    },
    Patrolling: {
        id: 'Patrolling', label: 'Patrolling', family: 'defensive',
        conditional: true, minHold: 2,
        blurb: 'Walking the edge of a pack\'s ground. Learns what is in the neighbouring sectors, and is the first to be met.',
    },
    /*
     * AUDIT-7 §12.6: two more, chosen to take share from somewhere specific.
     *
     * The three unconditional stances hold 80% of all stance-time and the seven
     * conditional ones share 20%, so an eleventh stance lands at about 1.5% of
     * cycles unless it has a case the roster genuinely could not express. These
     * two do.
     */
    Tending: {
        id: 'Tending', label: 'Tending', family: 'defensive',
        conditional: true, minHold: 2,
        blurb: 'Working on themselves rather than on the arena: dressing a wound, drying out, sleeping properly for once.',
    },
    Baiting: {
        id: 'Baiting', label: 'Baiting', family: 'aggressive',
        conditional: true, minHold: 2,
        blurb: 'Deliberately visible, on ground they prepared. Wants to be found, in the one place being found is survivable.',
    },
    /*
     * AUDIT-8 §12.6: two more, each taking share from a named pool above 25%
     * rather than hoping for 1.5%. See the note on the `Stance` union.
     */
    Withdrawing: {
        id: 'Withdrawing', label: 'Withdrawing', family: 'evasive',
        // minHold 1: leaving is the one stance it is never wrong to abandon
        // the moment you have arrived, and a two-cycle floor would hold a
        // tribute in it standing still on the far bank.
        conditional: true, minHold: 1,
        blurb: 'Not hiding — going. Covers ground faster than anyone should and is easy to follow while doing it.',
    },
    Bartering: {
        id: 'Bartering', label: 'Bartering', family: 'defensive',
        conditional: true, minHold: 2,
        blurb: 'Has decided the next move is a conversation. Carrying something somebody wants, and willing to find out what it is worth.',
    },
};

/** Every stance, in display order. The single source of truth for iteration. */
export const STANCES: Stance[] = Object.keys(STANCE_PROFILES) as Stance[];


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
