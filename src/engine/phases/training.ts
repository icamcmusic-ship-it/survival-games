import { SimContext, getAlive } from '../context';
import { RNG } from '../../utils/rng';

export function processTraining(ctx: SimContext) {
    ctx.state.phase = 'training';
    ctx.rng = new RNG(`${ctx.state.seed}-training`);

    getAlive(ctx.state).forEach(t => {
        const attrs = ['strength', 'agility', 'intelligence', 'stealth', 'charisma'] as const;
        const boosted = ctx.rng.pick([...attrs]);
        t.attributes[boosted] = Math.min(10, t.attributes[boosted] + 1);

        const totalStats = Object.values(t.attributes).reduce((a, b) => a + b, 0);
        t.trainingScore = Math.min(12, Math.max(1, Math.floor(totalStats / 4) + ctx.rng.nextInt(-2, 2)));
        t.excitementRating += t.trainingScore * 5;

        ctx.logEvent(`${t.name} focused on ${boosted} during training and scored a ${t.trainingScore}.`, [t.id]);
    });
}
