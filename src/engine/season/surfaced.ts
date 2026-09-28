import { GameState, Tribute } from '../../models/types';
import { ArenaMastery, CampaignLedger, SeasonLedger, StoryChainProgress } from '../../models/seasonTypes';
import { AUDIT12_WAVE3, AUDIT13_SIDE } from '../../data/balance';
import { SPONSOR_BLOCS } from '../sponsorBlocs';
import { campaignOf } from '../campaign';
import { STORY_CHAIN_META, storyChainIndex } from '../../data/replayCards';

type StoryChain = (typeof STORY_CHAIN_META)[number];

/**
 * AUDIT-13 §11 S1-S4: the side systems the engine already ran and no screen
 * ever told the player about. Every function here is a pure read over the
 * ledger or a finished/live state; none of them decides anything, so the UI
 * and the achievements that call them cannot drift from what the engine did.
 */

/* -------------------------------------------------------------------------- */
/* S1: story chains                                                            */
/* -------------------------------------------------------------------------- */

export interface ChapterChip {
    chain: StoryChain;
    /** 1-based: the chapter the next Games here will open on. */
    chapter: number;
    of: number;
    /** Times this arena's stories have been told in full. */
    completed: number;
}

function hashKey(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
}

/**
 * The chain the next Games in `arenaKey` will pick up, from the saved
 * progress alone. Mirrors `chainFor` (which needs a live state), including its
 * rotation by completed count, so the setup chip names the chain the run will
 * actually play.
 */
export function chapterChipFor(chains: Record<string, StoryChainProgress> | undefined, arenaKey: string, arenaName?: string): ChapterChip {
    const S = AUDIT12_WAVE3.story;
    // Progress written before AUDIT-13 was keyed by the arena's name.
    const saved = chains?.[arenaKey] ?? (arenaName ? chains?.[arenaName] : undefined);
    const completed = saved?.completed ?? 0;
    const unfinished = saved && saved.step > 0 && saved.step < S.steps ? saved : undefined;
    const chain = (unfinished && STORY_CHAIN_META.find(c => c.id === unfinished.chainId))
        ?? STORY_CHAIN_META[storyChainIndex(hashKey(arenaKey), completed, STORY_CHAIN_META.length)];
    return { chain, chapter: (unfinished?.step ?? 0) + 1, of: S.steps, completed };
}

/* -------------------------------------------------------------------------- */
/* S2: returning grudges, nemeses, reunions                                    */
/* -------------------------------------------------------------------------- */

export interface ReturningStory {
    kind: 'nemesis' | 'rivalry' | 'reunion' | 'apprentice';
    text: string;
    /** Tributes in this cast the story is about. */
    ids: string[];
    /** For a nemesis: the districts they owe blood to. */
    districts?: number[];
}

const districtList = (ds: number[]) => ds.length === 1 ? `District ${ds[0]}` : `Districts ${ds.slice(0, -1).join(', ')} and ${ds[ds.length - 1]}`;

/**
 * What the ledger carried into this cast, in the order `applyLedgerAtReaping`
 * applies it. Reads the run's own campaign snapshot, so it describes the run
 * as it was created even after the record book has moved on.
 */
export function returningStories(state: Pick<GameState, 'tributes' | 'campaign'>): ReturningStory[] {
    const ledger: CampaignLedger | undefined = campaignOf(state.campaign).ledger;
    if (!ledger) return [];
    const cast = state.tributes;
    const of = (d: number) => cast.filter(t => t.district === d);
    const out: ReturningStory[] = [];
    (ledger.nemeses ?? []).forEach(n => {
        const vet = cast.find(t => t.name === n.name && t.veteranOf);
        if (!vet) return;
        const haters = cast.filter(t => n.victimDistricts.includes(t.district) && t.id !== vet.id);
        out.push({
            kind: 'nemesis', ids: [vet.id, ...haters.map(h => h.id)], districts: n.victimDistricts,
            text: `${vet.name} is back: ${n.kills} did not come home from ${n.arenaName}, and ${districtList(n.victimDistricts)} ${n.victimDistricts.length === 1 ? 'has' : 'have'} not forgotten.`,
        });
    });
    (ledger.rivalries ?? []).filter(r => r.heat >= AUDIT12_WAVE3.rivalries.seedAt).slice(0, AUDIT12_WAVE3.rivalries.maxRivalries).forEach(r => {
        const a = of(r.aDistrict);
        const b = of(r.bDistrict);
        if (a.length === 0 || b.length === 0) return;
        out.push({
            kind: 'rivalry', ids: [...a, ...b].map(t => t.id), districts: [r.aDistrict, r.bDistrict],
            text: `Districts ${r.aDistrict} and ${r.bDistrict} have buried each other's children before. ${[...a, ...b].map(t => t.name).join(', ')} walk in hating on sight.`,
        });
    });
    (ledger.reunions ?? []).slice(0, AUDIT12_WAVE3.reunions.maxBonds).forEach(bond => {
        const a = of(bond.a);
        const b = of(bond.b);
        if (a.length === 0 || b.length === 0 || bond.a === bond.b) return;
        out.push({
            kind: 'reunion', ids: [...a, ...b].map(t => t.id), districts: [bond.a, bond.b],
            text: `Districts ${bond.a} and ${bond.b} found each other last time. ${[...a, ...b].map(t => t.name).join(', ')} have been told to look for each other.`,
        });
    });
    Object.entries(ledger.apprenticeships ?? {}).forEach(([d, choice]) => {
        const pupils = of(Number(d));
        if (pupils.length === 0) return;
        out.push({
            kind: 'apprentice', ids: pupils.map(t => t.id), districts: [Number(d)],
            text: `District ${d} spent the year being taught ${choice.skill} by ${choice.fromName}.`,
        });
    });
    return out;
}

/** The badge lines for one tribute: "Nemesis of Districts 3 and 5 (Games 4)". */
export function returningBadges(state: Pick<GameState, 'tributes' | 'campaign'>, t: Tribute): string[] {
    const ledger = campaignOf(state.campaign).ledger;
    const badges: string[] = [];
    (ledger?.nemeses ?? []).forEach(n => {
        if (t.veteranOf && t.name === n.name) badges.push(`Nemesis of ${districtList(n.victimDistricts)} (Games ${n.run})`);
        else if (n.victimDistricts.includes(t.district) && state.tributes.some(o => o.veteranOf && o.name === n.name)) badges.push(`Owes ${n.name} a debt from Games ${n.run}`);
    });
    returningStories(state).forEach(s => {
        if (!s.ids.includes(t.id)) return;
        if (s.kind === 'rivalry') badges.push(`Blood feud: District ${s.districts!.find(d => d !== t.district) ?? t.district}`);
        if (s.kind === 'reunion') badges.push(`Reunion: District ${s.districts!.find(d => d !== t.district) ?? t.district}`);
        if (s.kind === 'apprentice') badges.push('Apprenticed');
    });
    return [...new Set(badges)];
}

/* -------------------------------------------------------------------------- */
/* S3: arena mastery tiers                                                     */
/* -------------------------------------------------------------------------- */

export type MasteryTier = 'bronze' | 'silver' | 'gold';

export function masteryTier(m: ArenaMastery | undefined): MasteryTier | undefined {
    const runs = m?.runs ?? 0;
    const [bronze, silver, gold] = AUDIT13_SIDE.masteryTiers;
    return runs >= gold ? 'gold' : runs >= silver ? 'silver' : runs >= bronze ? 'bronze' : undefined;
}

/** Mastery for an arena picked at setup, which knows the id and the name. */
export function masteryFor(ledger: SeasonLedger | undefined, arenaId: string, arenaName?: string): ArenaMastery | undefined {
    return ledger?.arenaMastery?.[arenaId] ?? (arenaName ? ledger?.arenaMastery?.[arenaName] : undefined);
}

/* -------------------------------------------------------------------------- */
/* S4: patron's regret                                                         */
/* -------------------------------------------------------------------------- */

/**
 * One line per sore bloc: which death soured it and what it costs now.
 * "The old victors' families are still sore after Rue (D11): gifts -25%."
 */
export function regretLines(state: GameState): string[] {
    const regret = state.season?.blocRegret ?? {};
    const lastGift = state.season?.lastGift ?? {};
    return SPONSOR_BLOCS.flatMap(b => {
        const r = regret[b.id];
        if (r === undefined || r >= AUDIT13_SIDE.regretShownBelow) return [];
        const souring = state.tributes
            .filter(t => t.status === 'dead' && lastGift[t.id]?.bloc === b.id)
            .sort((x, y) => (y.eliminationIndex ?? 0) - (x.eliminationIndex ?? 0))[0];
        const who = souring ? ` after ${souring.name} (D${souring.district})` : '';
        const name = `${b.name[0].toUpperCase()}${b.name.slice(1)}`;
        return [`${name} ${name.startsWith('The') ? 'are' : 'is'} still sore${who}: gifts ${Math.round((r - 1) * 100)}%.`];
    });
}
