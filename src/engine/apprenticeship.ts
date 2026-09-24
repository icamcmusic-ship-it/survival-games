import { Proficiency, Tribute } from '../models/types';
import { SimContext, getAlive } from './context';
import { profOf, trainProficiency } from './proficiency';
import { samePlace } from './verticality';
import { getRel, adjustRel } from './relationships';
import { APPRENTICESHIP } from '../data/balance';


/**
 * AUDIT-10 B5-03: a repair apprenticeship.
 *
 * The fifth of the twelve nonlethal events the audit names. Somebody who knows
 * how to do a thing, standing beside somebody who does not, while the thing is
 * being done — the engine had all three facts and no way for them to matter.
 * `trainProficiency` has always been solitary: you get better by doing, never
 * by being shown.
 *
 * Checked before building, which is the lesson the shared-cooking beat taught
 * an hour earlier: across 60 runs there are 130 tribute-cycles with sited work
 * in progress, 101 of them with somebody else present, and 31 where that
 * somebody has a carpentry grade the worker does not. The opportunity exists,
 * so the beat is worth writing.
 *
 * The four parts §7 asks for. The **warning** is that the work is visibly going
 * badly — a novice on a five-hour shelter. The **choice** is the teacher's:
 * showing somebody how costs an hour of your own day, which is why it goes to
 * people you have time for rather than to anybody holding a plank. The
 * **nonfatal result** is that a shelter goes up faster and somebody knows
 * something they did not. And the **durable record** is the proficiency itself,
 * which outlives the shelter, the alliance, and usually the teacher.
 *
 * Teaching trains the teacher too, at a fraction. That is not generosity
 * accounting — explaining a thing is how you find out whether you understood
 * it — and it keeps the beat from being pure altruism in a game where pure
 * altruism is usually a mistake.
 */
export function offerApprenticeship(ctx: SimContext, learner: Tribute, skill: Proficiency): boolean {
    const grade = profOf(learner, skill);
    const teacher = getAlive(ctx.state).find(o =>
        o.id !== learner.id
        && samePlace(ctx.state.arena, learner, o)
        && profOf(o, skill) - grade >= APPRENTICESHIP.minGap
        // Showing somebody how costs the teacher an hour they could have spent
        // on themselves, so it is a thing done for people, not for strangers.
        && getRel(o, learner.id) > APPRENTICESHIP.minRegard);
    if (!teacher) return false;
    if (!ctx.rng.chance(APPRENTICESHIP.chance)) return false;

    trainProficiency(learner, skill, ctx, APPRENTICESHIP.learnerShare);
    // Explaining a thing is how you find out whether you understood it.
    trainProficiency(teacher, skill, ctx, APPRENTICESHIP.teacherShare);
    adjustRel(learner, teacher.id, APPRENTICESHIP.regard);
    adjustRel(teacher, learner.id, APPRENTICESHIP.regard);

    ctx.logEvent(
        `${teacher.name} watches ${learner.name} make a mess of it for a while, then takes the work off them `
        + `and does it slowly, once, so ${learner.name} can see how. Then hands it back.`,
        [teacher.id, learner.id],
        // AUDIT-11 §8: a visible moment — a headline, with the plain fact, so
        // the lesson is not lost in the ambient tier of the feed.
        {
            category: 'survival', zone: learner.zone, important: true, actorId: teacher.id,
            fact: `${teacher.name} taught ${learner.name} ${skill}.`,
        },
    );
    return true;
}
