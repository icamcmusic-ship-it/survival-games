import { SimContext, getAlive } from '../context';
import { RNG } from '../../utils/rng';
import { INTERVIEW_SCENARIOS } from '../../data/flavorText';
import { getArchetypeModifiers } from '../../data/archetypes';

export function processInterviews(ctx: SimContext) {
    ctx.state.phase = 'interviews';
    ctx.rng = new RNG(`${ctx.state.seed}-interviews`);

    getAlive(ctx.state).forEach(t => {
        const scenario = ctx.rng.pick(INTERVIEW_SCENARIOS);
        const roll = t.attributes.charisma + ctx.rng.nextInt(-2, 3) + getArchetypeModifiers(t).interviewBonus;
        const isSuccess = roll >= 5;

        if (isSuccess) {
            t.attributes.charisma = Math.min(10, t.attributes.charisma + scenario.charismaBuff);
            t.sponsorTrust = Math.floor(t.sponsorTrust * scenario.trustMultiplier);
            t.excitementRating += 20;
            ctx.logEvent(scenario.success.replace('{tribute}', t.name), [t.id], true);
        } else {
            t.sponsorTrust = Math.max(0, t.sponsorTrust - 10);
            ctx.logEvent(scenario.failure.replace('{tribute}', t.name), [t.id]);
        }
    });
}
