import { GameState, Tribute } from '../models/types';
import { SimContext } from './context';

/**
 * §9.4: sponsor blocs.
 *
 * `sponsorGenerosity` was a single scalar — one undifferentiated crowd with
 * bottomless pockets. The Capitol's money is actually several crowds, each
 * with its own taste and its own budget: the old victors' families back
 * Careers and pedigree, the industrial districts back their own and anyone
 * visibly competent, the romantics fund the love stories and the children,
 * and the betting syndicates chase form. Every parachute is now paid for by
 * one of them, the chronicle says which, and a bloc that has emptied its
 * purse stops giving — late-run scarcity that used to be impossible.
 */
export interface SponsorBloc {
    id: string;
    name: string;
    /** Appended to the parachute line so the reader learns who paid. */
    seal: string;
    /** Opening budget, scaled by the run's generosity setting. */
    budget: number;
    prefer: (state: GameState, t: Tribute) => number;
}

export const SPONSOR_BLOCS: SponsorBloc[] = [
    {
        id: 'old-money',
        name: 'the old victors’ families',
        seal: 'The parachute bears the seal of the old victors’ families — pedigree paying for pedigree.',
        budget: 600,
        prefer: (_state, t) => 0.2
            + (t.isCareer ? 3 : 0)
            + (t.trainingScore >= 9 ? 2 : 0)
            + ([1, 2, 4].includes(t.district) ? 1 : 0)
            + t.kills * 0.3,
    },
    {
        id: 'industry',
        name: 'the industrial districts’ syndicate',
        seal: 'The crate is stamped with a manufacturing district’s mark — the syndicates reward people who work.',
        budget: 400,
        prefer: (_state, t) => 0.2
            + ([3, 5, 6, 8, 9, 10].includes(t.district) ? 2 : 0)
            + Object.values(t.proficiencies ?? {}).reduce((s, v) => s + (v ?? 0), 0) * 0.4
            + (t.attributes.intelligence >= 7 ? 1 : 0),
    },
    {
        id: 'romantics',
        name: 'the Capitol romantics',
        seal: 'The parachute is ribboned, not stamped — the romantics’ money, sent with a note nobody will ever read aloud.',
        budget: 350,
        prefer: (_state, t) => 0.2
            + (t.allianceId?.startsWith('lovers-') ? 4 : 0)
            + ((t.protectorBonds?.length ?? 0) > 0 ? 2 : 0)
            + (t.age <= 14 ? 2 : 0)
            + (t.fanFavourite ? 2 : 0),
    },
    {
        id: 'gamblers',
        name: 'the betting syndicates',
        seal: 'No seal at all — the betting syndicates protect their positions quietly.',
        budget: 300,
        prefer: (_state, t) => 0.2
            + (t.momentum ?? 0) * 0.8
            + t.kills * 0.5
            + t.excitementRating * 0.02
            + (t.trainingScore <= 4 ? 1 : 0),
    },
];

function budgets(ctx: SimContext): Record<string, number> {
    if (!ctx.state.sponsorBlocBudgets) {
        const generosity = Math.max(0.25, ctx.state.config.sponsorGenerosity);
        ctx.state.sponsorBlocBudgets = Object.fromEntries(
            SPONSOR_BLOCS.map(b => [b.id, Math.round(b.budget * generosity)]));
    }
    return ctx.state.sponsorBlocBudgets;
}

/**
 * Picks (and charges) the bloc paying for a gift of `cost`. Returns the bloc,
 * or undefined when every purse that would care is empty — in which case the
 * parachute simply does not come, which is the point of budgets existing.
 */
export function drawFromBloc(ctx: SimContext, t: Tribute, cost: number): SponsorBloc | undefined {
    const purse = budgets(ctx);
    const scored = SPONSOR_BLOCS
        .filter(b => (purse[b.id] ?? 0) >= cost * 0.5)
        .map(b => ({ b, weight: b.prefer(ctx.state, t) }));
    if (scored.length === 0) return undefined;
    let roll = ctx.rng.nextFloat() * scored.reduce((sum, s) => sum + s.weight, 0);
    for (const s of scored) {
        roll -= s.weight;
        if (roll <= 0) {
            purse[s.b.id] = Math.max(0, (purse[s.b.id] ?? 0) - cost);
            return s.b;
        }
    }
    const last = scored[scored.length - 1].b;
    purse[last.id] = Math.max(0, (purse[last.id] ?? 0) - cost);
    return last;
}
