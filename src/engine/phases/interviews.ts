import { SimContext, getAlive } from '../context';
import { RNG } from '../../utils/rng';
import { INTERVIEW_SCENARIOS } from '../../data/flavorText';
import { getArchetypeModifiers } from '../../data/archetypes';
import { INTERVIEW_ANGLES, ARCHETYPE_ANGLE_AFFINITY } from '../../data/interviewAngles';

export function processInterviews(ctx: SimContext) {
    ctx.state.phase = 'interviews';
    ctx.rng = new RNG(`${ctx.state.seed}-interviews`);

    getAlive(ctx.state).forEach(t => {
        const preferredAngleId = ARCHETYPE_ANGLE_AFFINITY[t.archetype];
        const angle = (preferredAngleId && ctx.rng.chance(0.7)
            ? INTERVIEW_ANGLES.find(a => a.id === preferredAngleId)
            : ctx.rng.pick(INTERVIEW_ANGLES))!;

        const scenario = ctx.rng.pick(INTERVIEW_SCENARIOS);
        const roll = t.attributes.charisma + ctx.rng.nextInt(-2, 3) + getArchetypeModifiers(t).interviewBonus + angle.charismaBonus;
        const isSuccess = roll >= 5;

        ctx.logEvent(`${t.name} plays a ${angle.name} angle for the interview.`, [t.id]);

        if (isSuccess) {
            t.attributes.charisma = Math.min(10, t.attributes.charisma + scenario.charismaBuff);
            t.sponsorTrust = Math.min(100, Math.floor(t.sponsorTrust * scenario.trustMultiplier * angle.trustMultiplier));
            t.excitementRating += 20;
            ctx.logEvent(scenario.success.replace('{tribute}', t.name), [t.id], true);
        } else {
            t.sponsorTrust = Math.max(0, t.sponsorTrust - 10);
            ctx.logEvent(scenario.failure.replace('{tribute}', t.name), [t.id]);
        }
    });
}
