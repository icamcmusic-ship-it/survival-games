import { GameState, Tribute } from '../../models/types';
import { SimContext } from '../context';
import { adjustRel, getRel } from '../relationships';
import { scenarioCard } from '../../data/replayCards';
export { SCENARIO_CARDS, scenarioCard } from '../../data/replayCards';

/**
 * AUDIT-13 P1: scenario cards.
 *
 * An authored starting state, picked at setup like a mutator and carried in
 * the config (so saves, share links and replays reproduce it). Applied to the
 * cast the seed produced, at the reaping, with no RNG draws: the seed still
 * decides everybody, and the card decides only the one thing it is about.
 * Each card has its own achievement in `achievements.ts` (`a13-scenario-*`).
 */
const CAREER_DISTRICTS = [1, 2, 4];

/** The tributes a card is about, derived from the cast so it reads the same after the run. */
export function scenarioCast(state: Pick<GameState, 'tributes' | 'config'>): Tribute[] {
    const cast = state.tributes;
    switch (state.config.scenario) {
        case 'career-six':
            return cast.filter(t => CAREER_DISTRICTS.includes(t.district));
        case 'lone-volunteer': {
            const top = Math.max(...cast.map(t => t.district));
            return cast.filter(t => t.district === top).slice(0, 1);
        }
        case 'rival-allies': {
            const districts = [...new Set(cast.map(t => t.district))].sort((a, b) => a - b);
            if (districts.length < 2) return [];
            const lo = cast.find(t => t.district === districts[0]);
            const hi = cast.find(t => t.district === districts[districts.length - 1]);
            return lo && hi ? [lo, hi] : [];
        }
        default:
            return [];
    }
}

const bond = (a: Tribute, b: Tribute, regard: number) => {
    adjustRel(a, b.id, Math.max(0, regard - getRel(a, b.id)));
    adjustRel(b, a.id, Math.max(0, regard - getRel(b, a.id)));
};

/** Called once at the reaping, before the ledger's carry-over. No RNG. */
export function applyScenario(ctx: SimContext, cast: Tribute[]): void {
    const card = scenarioCard(ctx.state.config.scenario);
    if (!card) return;
    const who = scenarioCast({ tributes: cast, config: ctx.state.config });
    if (who.length === 0) return;
    if (card.id === 'career-six') {
        who.forEach(t => {
            t.isCareer = true;
            t.volunteered = true;
        });
        who.forEach(a => who.forEach(b => { if (a.id < b.id) bond(a, b, 60); }));
    } else if (card.id === 'lone-volunteer') {
        cast.forEach(t => { t.volunteered = false; });
        who[0].volunteered = true;
        who[0].resolve = Math.min(100, (who[0].resolve ?? 50) + 15);
    } else if (card.id === 'rival-allies' && who.length === 2) {
        bond(who[0], who[1], 75);
    }
    ctx.logEvent(`Scenario: ${card.name}. ${card.blurb} (${who.map(t => `${t.name}, D${t.district}`).join('; ')})`,
        who.map(t => t.id), { important: true, category: 'system' });
}
