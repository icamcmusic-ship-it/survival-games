import { CampaignFeud, CampaignSnapshot, GameState, Tribute } from '../models/types';
import { CAMPAIGN_ARC } from '../data/balance';
import { RNG } from '../utils/rng';

export type { CampaignSnapshot };

/**
 * AUDIT-9 B06: everything a career of Games contributes to a run, in one
 * serialisable object.
 *
 * A shared seed was not a complete replay specification. `processSquare` read
 * the player's persistent record book straight out of storage, and the store
 * applied patronage and victor-mentor bonuses on top of the generated cast.
 * With identical simulation input and nothing changed but the record book, one
 * tribute's opening sponsor trust moved from 63 to 71 — so the same link
 * handed two players different Games, and handed *the same* player different
 * Games after a few more runs.
 *
 * Campaign continuity is worth having; the defect was that it travelled
 * invisibly. This snapshot is taken once, at run creation, and stored on the
 * `GameState`, which means three things at once:
 *
 *   - the engine never reaches into storage, so a headless run and a browser
 *     run with an empty record book are byte-identical;
 *   - a save resumes with the record book it was played under, not whatever
 *     the player's career looks like now;
 *   - a share link can carry it (reproduce this exact run) or deliberately
 *     omit it (play this seed in my own campaign), and the difference is
 *     something the player chooses rather than something that happens to them.
 *
 * Deliberately a structural type rather than an import of `PanemRecords`: the
 * engine must not depend on the storage layer, which is the whole point.
 */

/**
 * The snapshot a run with no history behind it gets — and the one every
 * headless harness gets, so a check measures the game a first-time player is
 * handed rather than whichever career happened to be in the browser.
 */
export const FRESH_CAMPAIGN: CampaignSnapshot = { runs: 0, victors: 0 };

/**
 * The campaign a run was actually played under, defaulting to a fresh one.
 *
 * Every engine read goes through this rather than through storage, so
 * "no snapshot" has exactly one meaning and it is the documented one.
 */
export function campaignOf(snapshot: CampaignSnapshot | undefined): CampaignSnapshot {
    return snapshot ?? FRESH_CAMPAIGN;
}

/** True when this run carried no campaign history at all. */
export function isFreshCampaign(snapshot: CampaignSnapshot | undefined): boolean {
    return (snapshot?.runs ?? 0) === 0 && (snapshot?.patronDistricts?.length ?? 0) === 0;
}

/*
 * AUDIT-11 §8/§12: the campaign arc.
 *
 * A campaign used to be a record book the next run glanced at. Three things
 * now carry forward and change the Games they reach:
 *
 *   - the rebellion meter (0-100), moved by who wins and how they talk about
 *     it. It makes the Capitol crueller (hazards and mutts), the sponsors
 *     warier, and at `CAMPAIGN_ARC.quellAt` it calls a Quarter Quell — which
 *     the setup screen announces a season ahead, because it is a pure function
 *     of the record book the next run will be created from;
 *   - district reputation, the audience's memory of a district's crowns,
 *     kills and interviews, which warms or cools its tributes' sponsors;
 *   - rival victor feuds: a victor who put down another district's tribute in
 *     the last three places carries a grudge, and the two districts' tributes
 *     walk in hating each other.
 *
 * Everything is read from the snapshot on the state, so the engine still never
 * touches storage and a headless run (no snapshot) is byte-identical.
 */

/** The campaign's rebellion meter, 0-100. */
export function rebellionOf(snapshot: CampaignSnapshot | undefined): number {
    const r = snapshot?.rebellion;
    if (typeof r !== 'number' || !Number.isFinite(r)) return isFreshCampaign(snapshot) ? 0 : CAMPAIGN_ARC.rebellionStart;
    return Math.max(0, Math.min(CAMPAIGN_ARC.rebellionMax, r));
}

/** A word for the meter, for the briefing and the run profile. */
export function rebellionLabel(r: number): string {
    if (r >= CAMPAIGN_ARC.quellAt) return 'open unrest';
    if (r >= CAMPAIGN_ARC.restlessAt) return 'restless';
    if (r >= CAMPAIGN_ARC.murmurAt) return 'murmuring';
    return 'quiet';
}

/** Multiplier on arena hazards and mutts: the Capitol answers unrest with cruelty. */
export function capitolCruelty(snapshot: CampaignSnapshot | undefined): number {
    return 1 + (rebellionOf(snapshot) / CAMPAIGN_ARC.rebellionMax) * CAMPAIGN_ARC.crueltyMax;
}

/** A district's standing with the audience, -max..+max. */
export function districtReputationOf(snapshot: CampaignSnapshot | undefined, district: number): number {
    const v = snapshot?.districtReputation?.[district];
    return typeof v === 'number' && Number.isFinite(v)
        ? Math.max(-CAMPAIGN_ARC.reputationMax, Math.min(CAMPAIGN_ARC.reputationMax, v))
        : 0;
}

/** Sponsor generosity multiplier for one district's tributes under this campaign. */
export function campaignSponsorMultiplier(snapshot: CampaignSnapshot | undefined, district: number): number {
    if (!snapshot) return 1;
    const wary = 1 - (rebellionOf(snapshot) / CAMPAIGN_ARC.rebellionMax) * CAMPAIGN_ARC.sponsorWarinessMax;
    const rep = 1 + districtReputationOf(snapshot, district) * CAMPAIGN_ARC.reputationGenerosityPerPoint;
    return Math.max(0.5, wary * rep);
}

/** True when the rebellion has reached the point where the Capitol calls a Quell. */
export function rebellionCallsQuell(snapshot: CampaignSnapshot | undefined): boolean {
    return rebellionOf(snapshot) >= CAMPAIGN_ARC.quellAt;
}

/**
 * Whether this Games reaps a legacy tribute — a Hall of Fame victor, again.
 * Always in a Quell; otherwise only in an established campaign, on a draw
 * from its own seeded stream so the main cast is untouched.
 */
export function legacyReapingDue(snapshot: CampaignSnapshot | undefined, seed: string, isQuell: boolean): boolean {
    if (!snapshot || isFreshCampaign(snapshot) || snapshot.victors === 0) return false;
    if (isQuell) return true;
    if (snapshot.runs < CAMPAIGN_ARC.legacyMinRuns) return false;
    return new RNG(`${seed}-legacy`).chance(CAMPAIGN_ARC.legacyChance);
}

/** The single given name a legacy tribute is reaped under (no surnames). */
export function givenName(name: string): string {
    return name.trim().split(/\s+/)[0] ?? name;
}

/**
 * Applies the campaign arc to a freshly reaped cast. Consumes no RNG; returns
 * lines for the caller to log, so the pregame phase owns its own narration.
 */
export function applyCampaignArc(
    snapshot: CampaignSnapshot | undefined,
    cast: Tribute[],
    setRegard: (a: Tribute, b: Tribute, regard: number) => void,
): Array<{ text: string; ids: string[] }> {
    if (!snapshot || isFreshCampaign(snapshot)) return [];
    const lines: Array<{ text: string; ids: string[] }> = [];
    const r = rebellionOf(snapshot);
    if (r >= CAMPAIGN_ARC.murmurAt) {
        lines.push({
            text: r >= CAMPAIGN_ARC.quellAt
                ? `The districts are in open unrest (rebellion ${Math.round(r)}). The Capitol has made these Games crueller on purpose, and the sponsors are keeping their purses close.`
                : `The districts are ${rebellionLabel(r)} (rebellion ${Math.round(r)}). The Gamemakers have been told to remind them what the Games are for.`,
            ids: [],
        });
    }
    const districts = [...new Set(cast.map(t => t.district))].sort((a, b) => a - b);
    districts.forEach(d => {
        const rep = districtReputationOf(snapshot, d);
        if (rep === 0) return;
        const locals = cast.filter(t => t.district === d);
        const delta = Math.round(rep * CAMPAIGN_ARC.reputationTrustPerPoint);
        locals.forEach(t => { t.sponsorTrust = Math.max(0, Math.min(100, t.sponsorTrust + delta)); });
        if (Math.abs(rep) >= CAMPAIGN_ARC.reputationNamedAt) {
            lines.push({
                text: rep > 0
                    ? `District ${d} arrives with a following: the Capitol remembers its last few Games fondly.`
                    : `District ${d} arrives under a cloud. The audience has not forgotten how its last Games went.`,
                ids: locals.map(t => t.id),
            });
        }
    });
    (snapshot.feuds ?? []).forEach(f => {
        const a = cast.filter(t => t.district === f.aDistrict);
        const b = cast.filter(t => t.district === f.bDistrict);
        if (a.length === 0 || b.length === 0) return;
        a.forEach(x => b.forEach(y => setRegard(x, y, CAMPAIGN_ARC.feudRegard)));
        lines.push({
            text: `${f.aName} of District ${f.aDistrict} and ${f.bName} of District ${f.bDistrict} have not spoken since the ${ordinalOf(f.run)} Games. Their tributes were raised on the feud.`,
            ids: [...a, ...b].map(t => t.id),
        });
    });
    return lines;
}

function ordinalOf(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** The arc fields folded forward by one finished run. Pure. */
export interface CampaignArc {
    rebellion: number;
    districtReputation: Record<number, number>;
    feuds: CampaignFeud[];
}

export function foldCampaignArc(prev: Partial<CampaignArc> & { runs?: number; victorMentors?: CampaignSnapshot['victorMentors'] }, state: GameState, runNumber: number): CampaignArc {
    const winners = state.tributes.filter(t => t.status === 'alive');
    let rebellion = typeof prev.rebellion === 'number' ? prev.rebellion : CAMPAIGN_ARC.rebellionStart;
    if (winners.length === 0) rebellion += CAMPAIGN_ARC.rebellionNoVictor;
    winners.forEach(w => {
        if (w.isCareer) rebellion += CAMPAIGN_ARC.rebellionCareerVictor;
        else if (w.district >= CAMPAIGN_ARC.outlierDistrictMin) rebellion += CAMPAIGN_ARC.rebellionOutlierVictor;
    });
    if (winners.length > 0 && (state.interviewReception ?? 0) < 0) rebellion += CAMPAIGN_ARC.rebellionDefiantInterview;
    rebellion += state.tributes.filter(t => t.status === 'dead' && t.age <= CAMPAIGN_ARC.youngDeathAge).length * CAMPAIGN_ARC.rebellionYoungDeath;
    rebellion = Math.max(0, Math.min(CAMPAIGN_ARC.rebellionMax, Math.round(rebellion)));

    const rep: Record<number, number> = {};
    Object.entries(prev.districtReputation ?? {}).forEach(([d, v]) => {
        if (typeof v === 'number' && Number.isFinite(v)) rep[Number(d)] = v * CAMPAIGN_ARC.reputationKeep;
    });
    const bump = (d: number, by: number) => { rep[d] = (rep[d] ?? 0) + by; };
    winners.forEach(w => {
        bump(w.district, CAMPAIGN_ARC.reputationPerCrown);
        bump(w.district, (state.interviewReception ?? 0) * CAMPAIGN_ARC.reputationPerReception);
    });
    state.tributes.forEach(t => { if (t.kills > 0) bump(t.district, t.kills * CAMPAIGN_ARC.reputationPerKill); });
    Object.keys(rep).forEach(k => {
        const d = Number(k);
        const v = Math.round(Math.max(-CAMPAIGN_ARC.reputationMax, Math.min(CAMPAIGN_ARC.reputationMax, rep[d])));
        if (v === 0) delete rep[d]; else rep[d] = v;
    });

    // A feud: the victor and the runner-up's district, when that district's
    // own last victor is alive in the mentor's chair to take it personally.
    let feuds = [...(prev.feuds ?? [])];
    const mentors = prev.victorMentors ?? {};
    const runnerUp = state.tributes
        .filter(t => t.status === 'dead' && !winners.some(w => w.district === t.district))
        .sort((a, b) => (b.eliminationIndex ?? b.dayOfDeath ?? 0) - (a.eliminationIndex ?? a.dayOfDeath ?? 0))[0];
    const w = winners[0];
    if (w && runnerUp && mentors[runnerUp.district]) {
        const rival = mentors[runnerUp.district]!;
        const pair = (f: CampaignFeud) => (f.aDistrict === w.district && f.bDistrict === runnerUp.district)
            || (f.bDistrict === w.district && f.aDistrict === runnerUp.district);
        feuds = feuds.filter(f => !pair(f));
        feuds.unshift({ aName: w.name, aDistrict: w.district, bName: rival.name, bDistrict: runnerUp.district, run: runNumber });
    }
    feuds = feuds.slice(0, CAMPAIGN_ARC.feudMax);
    return { rebellion, districtReputation: rep, feuds };
}
