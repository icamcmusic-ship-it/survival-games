import { SimContext, getAlive } from '../context';
import { RNG } from '../../utils/rng';
import { INTERVIEW_SCENARIOS } from '../../data/flavorText';
import { clampTribute } from '../vitals';
import { adjustRel } from '../relationships';
import { addExcitement } from '../audience';

export function processInterviews(ctx: SimContext) {
    ctx.state.phase = 'interviews';
    ctx.rng = new RNG(`${ctx.state.seed}-interviews`);

    const cast = getAlive(ctx.state);

    cast.forEach(t => {
        const scenario = ctx.rng.pick(INTERVIEW_SCENARIOS);
        const roll = t.attributes.charisma + ctx.rng.nextInt(-2, 3);
        const isSuccess = roll >= 5;

        // The persona is public and permanent — the rest of the cast watched it,
        // and the alliance and bloodbath layers read it back.
        t.interviewStrategy = scenario.strategy;

        if (isSuccess) {
            t.attributes.charisma = Math.min(10, t.attributes.charisma + scenario.charismaBuff);
            t.sponsorTrust = Math.min(100, Math.floor(t.sponsorTrust * scenario.trustMultiplier));
            t.reputation = Math.min(95, Math.round(t.reputation + (scenario.trustMultiplier - 1) * 30));
            addExcitement(t, 20);
            ctx.logEvent(`[${scenario.strategy}] ` + ctx.pickText(scenario.success).split('{tribute}').join(t.name), [t.id], { important: true, category: 'interview' });
        } else {
            t.sponsorTrust = Math.max(0, t.sponsorTrust - 10);
            t.reputation = Math.max(5, t.reputation - 5);
            ctx.logEvent(`[${scenario.strategy}] ` + ctx.pickText(scenario.failure).split('{tribute}').join(t.name), [t.id], { category: 'interview' });
        }
        clampTribute(t);
    });

    // Everyone watched the same broadcast. A tribute who spent three minutes
    // promising a short Games has made a first impression on twenty-three
    // people, and it is not a warm one.
    cast.forEach(t => {
        const hostile = t.interviewStrategy === 'The Ruthless Warrior' || t.interviewStrategy === 'The Arrogant Brute';
        const warm = t.interviewStrategy === 'The Star-Crossed Lover' || t.interviewStrategy === 'The Humble Underdog';
        if (!hostile && !warm) return;
        cast.forEach(other => {
            if (other.id === t.id) return;
            if (hostile) adjustRel(other, t.id, other.isCareer ? 4 : -10);
            if (warm) adjustRel(other, t.id, 6);
        });
    });

    const boldest = cast.filter(t => t.interviewStrategy === 'The Ruthless Warrior' || t.interviewStrategy === 'The Arrogant Brute');
    if (boldest.length > 0) {
        ctx.logEvent(
            `The Capitol replays the threats all night. ${boldest.map(t => t.name).join(', ')} will walk into that arena with a target already painted on.`,
            boldest.map(t => t.id),
            { important: true, category: 'interview' }
        );
    }
}
