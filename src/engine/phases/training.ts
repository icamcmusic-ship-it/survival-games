import { SimContext, getAlive } from '../context';
import { RNG } from '../../utils/rng';
import { getArchetypeModifiers } from '../../data/archetypes';
import { TRAINING_STATIONS, ARCHETYPE_STATION_AFFINITY } from '../../data/trainingStations';

const TRAINING_SESSIONS = 2;

export function processTraining(ctx: SimContext) {
    ctx.state.phase = 'training';
    ctx.rng = new RNG(`${ctx.state.seed}-training`);

    getAlive(ctx.state).forEach(t => {
        const preferredStationId = ARCHETYPE_STATION_AFFINITY[t.archetype];
        const visited = new Set<string>();

        for (let session = 1; session <= TRAINING_SESSIONS; session++) {
            const preferred = preferredStationId && !visited.has(preferredStationId) && ctx.rng.chance(0.6)
                ? TRAINING_STATIONS.find(s => s.id === preferredStationId)
                : undefined;
            const available = TRAINING_STATIONS.filter(s => !visited.has(s.id));
            const station = preferred || ctx.rng.pick(available);
            visited.add(station.id);

            t.attributes[station.attr] = Math.min(10, t.attributes[station.attr] + 1);
            ctx.logEvent(`${t.name} trains at the ${station.name} (Session ${session}/${TRAINING_SESSIONS}).`, [t.id]);
        }

        const totalStats = Object.values(t.attributes).reduce((a, b) => a + b, 0);
        t.trainingScore = Math.min(12, Math.max(1, Math.floor(totalStats / 4) + ctx.rng.nextInt(-2, 2) + getArchetypeModifiers(t).trainingBonus));
        t.excitementRating += t.trainingScore * 5;

        ctx.logEvent(`${t.name} finishes private training with a score of ${t.trainingScore}.`, [t.id], true);
    });
}
