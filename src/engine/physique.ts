import { Build, Condition, Frame, InjurySite, LimbRatio, Tribute } from '../models/types';
import { PHYSIQUE, GENERATION } from '../data/balance';

/**
 * Bodies, on two axes.
 *
 * §3.1: `massOf()` used to return a signed scalar from `PHYSIQUE.massByBuild`
 * and `reachBonus()` read `heightCm`. That was the entire physical model — six
 * builds on a single axis, rolled as a blend of a random frame and strength/2 —
 * and it could not express the one physical arc a survival simulation most
 * wants: a body changing over the run.
 *
 * So `build` splits in two.
 *
 *   Frame       skeleton. Narrow · Spare · Even · Broad · Heavy. Fixed at the
 *               reaping, correlates with height. Raises reach, carry capacity,
 *               grapple resistance and the damage floor; lowers concealment,
 *               chokepoint passage, climb speed and hunger drain.
 *   Condition   soft tissue. Wasted · Lean · Conditioned · Padded · Bulky.
 *               Mutable. Raises cold insulation, starvation buffer and injury
 *               absorption; lowers agility, heat tolerance and water need.
 *
 * Twenty-five combinations, each with a name a human would use, and the two
 * axes deliberately pull in opposite directions so the grid is a set of
 * trade-offs rather than a longer ladder. The key move is that condition
 * *degrades*: six days of starvation walks a tribute Padded -> Lean -> Wasted,
 * stripping their cold resistance and their starvation buffer at exactly the
 * moment they need both, while their frame — and so their reach, their carry
 * and their intimidation value — is unchanged. A big frame gone hollow still
 * reads dangerous from across a zone.
 */

const FRAMES: Frame[] = ['Narrow', 'Spare', 'Even', 'Broad', 'Heavy'];
const CONDITIONS: Condition[] = ['Wasted', 'Lean', 'Conditioned', 'Padded', 'Bulky'];

/** Steps from the middle of the frame scale, signed. */
export function frameStep(t: Tribute): number {
    return (PHYSIQUE.frameOrder[frameOf(t)] ?? 2) - 2;
}

/** Steps from the middle of the condition scale, signed. */
export function conditionStep(t: Tribute): number {
    return (PHYSIQUE.conditionOrder[conditionOf(t)] ?? 2) - 2;
}

/**
 * A tribute's frame, tolerating a pre-§3.1 save that only has `build`.
 * The legacy ladder maps onto the frame axis by position; a save's condition
 * defaults to the middle, which is the only honest reading of a body that was
 * never allowed to change.
 */
export function frameOf(t: Tribute): Frame {
    if (t.frame) return t.frame;
    const legacy: Record<Build, Frame> = {
        Frail: 'Narrow', Slight: 'Spare', Average: 'Even',
        Athletic: 'Even', Stocky: 'Broad', Muscular: 'Heavy',
    };
    return legacy[t.build as Build] ?? 'Even';
}

export function conditionOf(t: Tribute): Condition {
    if (t.condition) return t.condition;
    const legacy: Record<Build, Condition> = {
        Frail: 'Wasted', Slight: 'Lean', Average: 'Conditioned',
        Athletic: 'Conditioned', Stocky: 'Padded', Muscular: 'Bulky',
    };
    return legacy[t.build as Build] ?? 'Conditioned';
}

export function limbRatioOf(t: Tribute): LimbRatio {
    return t.limbRatio ?? 'even';
}

/** How much of a tribute there is: skeleton plus soft tissue. */
export function massOf(t: Tribute): number {
    return (PHYSIQUE.massByFrame[frameOf(t)] ?? 0) + (PHYSIQUE.massByCondition[conditionOf(t)] ?? 0);
}

/**
 * Melee power from reach. A long-armed tribute lands first — and limb length
 * is not the same thing as standing height, so a compact 175cm tribute can
 * genuinely be out-reached by a long-limbed 168cm one.
 */
export function reachBonus(t: Tribute): number {
    const effectiveCm = t.heightCm + PHYSIQUE.limbReachCm[limbRatioOf(t)]
        + frameStep(t) * PHYSIQUE.framePerStep.damageFloor;
    const advantage = (effectiveCm - PHYSIQUE.neutralHeightCm) * PHYSIQUE.reachPerCm;
    return Math.max(-PHYSIQUE.maxReachBonus, Math.min(PHYSIQUE.maxReachBonus, advantage));
}

/** How hard this tribute is to shove, trip, drag or pin. */
export function grappleResistance(t: Tribute): number {
    return frameStep(t) * PHYSIQUE.framePerStep.grappleResist;
}

/** Soft tissue between a blade and the parts that matter, 0-1 as a multiplier. */
export function injuryAbsorption(t: Tribute): number {
    return Math.max(0, conditionStep(t) * PHYSIQUE.conditionPerStep.injuryAbsorb);
}

/** Cold insulation from condition alone — the thing starvation takes first. */
export function insulation(t: Tribute): number {
    return conditionStep(t) * PHYSIQUE.conditionPerStep.insulation;
}

/** ...and the same axis working against them in the heat. */
export function heatBurden(t: Tribute): number {
    return Math.max(0, conditionStep(t)) * PHYSIQUE.conditionPerStep.heatTolerance;
}

/** Extra water a heavier body wants, as a multiplier on the thirst drain. */
export function waterNeedMultiplier(t: Tribute): number {
    return 1 + Math.max(0, conditionStep(t)) * PHYSIQUE.conditionPerStep.waterNeed;
}

/** Hunger runs faster on a bigger skeleton, whatever is wrapped around it. */
export function hungerDrainMultiplier(t: Tribute): number {
    return 1 + frameStep(t) * PHYSIQUE.framePerStep.hungerDrain;
}

/** How long a tribute can run on nothing before the drains start hurting. */
export function starvationBuffer(t: Tribute): number {
    return conditionStep(t) * PHYSIQUE.conditionPerStep.starvationBuffer;
}

/** Agility the soft tissue costs. Positive numbers are a penalty. */
export function conditionAgilityPenalty(t: Tribute): number {
    return Math.max(0, conditionStep(t)) * PHYSIQUE.conditionPerStep.agility;
}

/** How well this body hides. A big frame is a big thing to put behind a rock. */
export function concealmentModifier(t: Tribute): number {
    return -frameStep(t) * PHYSIQUE.framePerStep.concealment;
}

/** Squeezing through a gap: frame against you, compact limbs for you. */
export function chokepointModifier(t: Tribute): number {
    return -frameStep(t) * PHYSIQUE.framePerStep.chokepoint + PHYSIQUE.limbChokepoint[limbRatioOf(t)];
}

/** Going up something: same trade, different sign on the limbs. */
export function climbModifier(t: Tribute): number {
    return -frameStep(t) * PHYSIQUE.framePerStep.climb + PHYSIQUE.limbClimb[limbRatioOf(t)];
}

/**
 * §3.1: what another tribute reads across a zone.
 *
 * Deliberately weighted toward frame. Being hollowed out takes back some of it
 * but nothing like all of it — a Heavy/Wasted tribute is still the biggest
 * person in the clearing, and threat assessment is done at a distance by
 * frightened people.
 */
export function visibleBulk(t: Tribute): number {
    return frameStep(t) * PHYSIQUE.visibleFramePerStep
        + Math.min(0, conditionStep(t)) * PHYSIQUE.visibleConditionPerStep;
}

/**
 * §3.1: whether a wound has landed on the side this tribute actually uses.
 *
 * `favouring` and `scars` already exist; handedness is what makes them
 * asymmetric. A left-handed tribute with a ruined left arm has lost their
 * weapon hand; a right-handed one has lost their shield side.
 */
export function dominantSideCost(t: Tribute, site: InjurySite, side?: 'left' | 'right'): number {
    if (site !== 'arms') return 1;
    if (!side) return 1;
    return side === (t.handedness ?? 'right') ? PHYSIQUE.dominantSideMultiplier : 1;
}

/**
 * The 5x5 grid, in words a human would use. This is what the tribute sheet
 * prints instead of one adjective.
 */
export function bodyLabel(t: Tribute): string {
    const frame = frameOf(t);
    const condition = conditionOf(t);
    const key = `${frame}/${condition}`;
    return BODY_PHRASES[key] ?? `${condition.toLowerCase()}, on ${FRAME_PHRASE[frame]}`;
}

const FRAME_PHRASE: Record<Frame, string> = {
    Narrow: 'a narrow frame',
    Spare: 'a spare frame',
    Even: 'an even frame',
    Broad: 'a broad frame',
    Heavy: 'a heavy frame',
};

/**
 * The combinations worth naming outright. Everything else falls through to the
 * generic "<condition>, on a <frame> frame", which still reads properly.
 */
const BODY_PHRASES: Record<string, string> = {
    'Narrow/Wasted': 'all bone and no reserve',
    'Narrow/Lean': 'whippet-thin',
    'Narrow/Conditioned': 'slight and quick with it',
    'Narrow/Padded': 'small and surprisingly well-fed',
    'Narrow/Bulky': 'a small frame carrying more than it should',
    'Spare/Wasted': 'gaunt',
    'Spare/Lean': 'lean and wiry',
    'Spare/Conditioned': 'trim and well-made',
    'Spare/Padded': 'slim but comfortably fed',
    'Spare/Bulky': 'thick through the middle on a narrow frame',
    'Even/Wasted': 'hollowed out',
    'Even/Lean': 'lean and ordinary',
    'Even/Conditioned': 'evenly built and in condition',
    'Even/Padded': 'solidly fed',
    'Even/Bulky': 'heavy-set',
    'Broad/Wasted': 'a broad frame gone hollow',
    'Broad/Lean': 'broad-shouldered and stripped down',
    'Broad/Conditioned': 'broad and in hard condition',
    'Broad/Padded': 'a solid, well-fed frame',
    'Broad/Bulky': 'a wall of a person',
    'Heavy/Wasted': 'a big frame gone hollow',
    'Heavy/Lean': 'big-boned and running lean',
    'Heavy/Conditioned': 'genuinely large and in condition',
    'Heavy/Padded': 'a large, heavily fed frame',
    'Heavy/Bulky': 'the largest person in the field, and it shows',
};

/**
 * §3.1: the derived legacy label, so `build` stays true as condition moves and
 * every pre-existing display site keeps working.
 */
export function deriveBuild(frame: Frame, condition: Condition): Build {
    const total = (PHYSIQUE.frameOrder[frame] ?? 2) + (PHYSIQUE.conditionOrder[condition] ?? 2);
    const ladder: Build[] = ['Frail', 'Frail', 'Slight', 'Average', 'Average', 'Athletic', 'Stocky', 'Stocky', 'Muscular'];
    return ladder[Math.max(0, Math.min(ladder.length - 1, total))];
}

/**
 * §3.1: a growth spurt in progress.
 *
 * A thirteen-year-old on a Broad frame running Lean is a specific and
 * recognisable kind of tribute — the kid who is going to be enormous in two
 * years and is not yet — and it is worth the roster saying so out loud.
 */
export function isGrowingInto(t: Tribute): boolean {
    return t.age <= PHYSIQUE.spurtMaxAge
        && frameStep(t) >= 1
        && conditionStep(t) <= 0;
}

/**
 * One cycle of the body changing.
 *
 * Pressure accumulates past the starvation line and unwinds on a full belly;
 * a whole step of condition costs `conditionStepPressure` either way, so the
 * arc is slow enough to be legible and fast enough to matter inside a seven-
 * day run. Frame never moves.
 */
export function driftCondition(t: Tribute): 'lost' | 'gained' | undefined {
    const hunger = t.vitals.hunger;
    if (hunger >= PHYSIQUE.starvingHunger) {
        t.conditionPressure = (t.conditionPressure ?? 0) + PHYSIQUE.conditionPressurePerStarvingCycle;
    } else if (hunger <= PHYSIQUE.fedHunger) {
        t.conditionPressure = (t.conditionPressure ?? 0) - PHYSIQUE.conditionPressurePerFedCycle;
    } else {
        return undefined;
    }

    const index = CONDITIONS.indexOf(conditionOf(t));
    if ((t.conditionPressure ?? 0) >= PHYSIQUE.conditionStepPressure && index > 0) {
        t.conditionPressure = 0;
        t.condition = CONDITIONS[index - 1];
        t.build = deriveBuild(frameOf(t), t.condition);
        return 'lost';
    }
    if ((t.conditionPressure ?? 0) <= -PHYSIQUE.conditionStepPressure && index < CONDITIONS.length - 1) {
        t.conditionPressure = 0;
        t.condition = CONDITIONS[index + 1];
        t.build = deriveBuild(frameOf(t), t.condition);
        return 'gained';
    }
    return undefined;
}

/** Frame and condition as generated at the reaping. */
export function rollBody(pickIndex: (max: number) => number, strength: number, heightCm: number): {
    frame: Frame; condition: Condition; build: Build;
} {
    // Frame correlates with height and, more weakly, with strength — the two
    // things that are actually skeleton-shaped — but keeps an independent roll
    // so a wiry powerhouse and a heavy-set average tribute both exist.
    const heightPull = (heightCm - PHYSIQUE.neutralHeightCm) / 12;
    const frameIdx = Math.round(
        pickIndex(FRAMES.length - 1) * GENERATION.buildFrameWeight
        + (strength / 2.5 + heightPull) * (1 - GENERATION.buildFrameWeight)
    );
    const frame = FRAMES[Math.min(FRAMES.length - 1, Math.max(0, frameIdx))];
    // Nobody walks into an arena Wasted; everyone has been fed for a week in
    // the Capitol. The bottom of the condition scale is somewhere the run
    // takes you, not somewhere you start.
    const condition = CONDITIONS[Math.min(CONDITIONS.length - 1, Math.max(1, pickIndex(CONDITIONS.length - 1)))];
    return { frame, condition, build: deriveBuild(frame, condition) };
}

/**
 * Formats a height for display. The underlying field is centimetres; the
 * player's unit preference (survivalGamesPrefs) decides how it reads.
 */
export function heightLabel(heightCm: number, units: 'imperial' | 'metric' = 'imperial'): string {
    if (units === 'metric') return `${Math.round(heightCm)} cm`;
    const totalInches = Math.round(heightCm / 2.54);
    return `${Math.floor(totalInches / 12)}'${totalInches % 12}"`;
}

/** The most raw strength a tribute of this age can possibly have. */
/**
 * §3.3: how much faster a young body gets a night back.
 *
 * Returns a multiplier on the *recovery* half of the fatigue tick only — it
 * never makes a young tribute tire more slowly, which would just be a flat
 * buff. Paired with `strengthCapForAge` above it, which is the price: the
 * twelve year old sleeps it off and still cannot lift what the eighteen year
 * old can.
 */
export function youthRecoveryMultiplier(age: number): number {
    const under = Math.max(0, GENERATION.agePivot - age);
    return 1 + under * GENERATION.youthRecoveryPerYear;
}

/**
 * §3.3: the other side of the curve — extra resolve decay per cycle for an
 * older tribute who has been under sustained tension. Zero for anyone at or
 * below the pivot, and zero for anyone whose run has been quiet: this is the
 * cost of *carrying* it, not of being eighteen.
 */
export function agedResolveDecay(age: number, tensionStreak: number): number {
    if (tensionStreak < GENERATION.agedResolveTensionFrom) return 0;
    const over = Math.max(0, age - GENERATION.agePivot);
    return over * GENERATION.agedResolveDecayPerYear;
}

export function strengthCapForAge(age: number): number {
    return Math.min(10, GENERATION.strengthCapAtMinAge + (age - GENERATION.minAge) * GENERATION.strengthCapPerYear);
}
