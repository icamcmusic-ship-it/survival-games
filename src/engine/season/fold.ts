import { GameState, PredictionResult, Tribute } from '../../models/types';
import { MuseumPiece, SeasonLedger } from '../../models/seasonTypes';
import { AUDIT12_WAVE3, CAMPAIGN_ARC, PREDICTION } from '../../data/balance';
import { QUELLS } from '../../data/gamesProfile';
import { drawMutators } from '../../data/mutators';
import { CAUSE_FAMILY, deathCodeOf } from '../causes';
import { RNG } from '../../utils/rng';
import { finishingOrder } from '../prediction';
import { isCarryableSkill } from './carry';
import { givenName } from '../campaign';
import { pairKey } from './runState';
import { allKillLedgers, killLedgerOf } from './killLedger';
export { isUpsetVictor } from './upset';

/**
 * AUDIT-12 wave 3: one finished Games folded into the season ledger. Pure over
 * (previous ledger, finished state, run number); `commitRun` persists it.
 */
const W = AUDIT12_WAVE3;

export interface FoldExtras {
    /** The run number this Games was (records.runs after it). */
    run: number;
    /** The rebellion meter after this Games' arc fold. */
    rebellion: number;
    slip?: PredictionResult;
    /** Whether the slip named the victor and the victor was an upset. */
    upsetCalled?: boolean;
    gauntletScore?: number;
}

const arenaKeyOf = (s: GameState) => s.arena.mapId ?? s.arena.name;

function dominantTerrain(s: GameState): string | undefined {
    const counts = new Map<string, number>();
    s.arena.zones.forEach(z => counts.set(z.terrain, (counts.get(z.terrain) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
}

function bestSkillOf(t: Tribute): string | undefined {
    return Object.entries(t.proficiencies ?? {})
        .filter(([k]) => isCarryableSkill(k))
        .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0) || a[0].localeCompare(b[0]))[0]?.[0];
}

export function foldSeasonLedger(prev: SeasonLedger | undefined, state: GameState, x: FoldExtras): SeasonLedger {
    const L: SeasonLedger = JSON.parse(JSON.stringify(prev ?? {})) as SeasonLedger;
    const run = x.run;
    const s = state.season ?? {};
    const winners = state.tributes.filter(t => t.status === 'alive');
    const castDistricts = new Set(state.tributes.map(t => t.district));
    const key = arenaKeyOf(state);

    // Apprenticeships: this reaping consumed the choice for every district that was in it.
    if (L.apprenticeships) {
        Object.keys(L.apprenticeships).map(Number).forEach(d => { if (castDistricts.has(d)) delete L.apprenticeships![d]; });
    }
    // ...and the Games offers what was taught in it, plus each district's best-trained skill.
    const offers: SeasonLedger['apprenticeOffers'] = {};
    (s.apprenticeLessons ?? []).forEach(l => {
        const o = offers[l.district] ?? (offers[l.district] = { skills: [], teacher: l.teacher, run });
        if (!o.skills.includes(l.skill)) o.skills.push(l.skill);
    });
    [...castDistricts].forEach(d => {
        const best = state.tributes.filter(t => t.district === d).map(bestSkillOf).filter((k): k is string => !!k);
        if (best.length === 0) return;
        const o = offers[d] ?? (offers[d] = { skills: [], teacher: state.tributes.find(t => t.district === d)!.name, run });
        best.forEach(k => { if (!o.skills.includes(k) && o.skills.length < 3) o.skills.push(k); });
    });
    L.apprenticeOffers = offers;

    // Reunions, by district pair; bonds older than two Games lapse.
    const bonds = (L.reunions ?? []).filter(b => run - b.run < 2);
    (s.reunionPairs ?? []).forEach(k => {
        const [a, b] = k.split('-').map(Number);
        const hit = bonds.find(x => pairKey(x.a, x.b) === k);
        if (hit) { hit.count += 1; hit.run = run; } else bonds.unshift({ a, b, count: 1, run });
    });
    L.reunions = bonds.slice(0, W.reunions.maxBonds);
    if (s.veteranDistricts?.length) {
        const respect = { ...(L.veteranRespect ?? {}) };
        s.veteranDistricts.forEach(d => { respect[d] = (respect[d] ?? 0) + 1; });
        L.veteranRespect = respect;
    }

    // Rivalries: every kill across districts is heat between them.
    const heat = new Map<string, { a: number; b: number; heat: number; lastRun: number }>();
    (L.rivalries ?? []).forEach(r => {
        const h = r.heat * W.rivalries.keep;
        if (h >= AUDIT12_WAVE3.rivalries.dropBelow) heat.set(pairKey(r.aDistrict, r.bDistrict), { a: Math.min(r.aDistrict, r.bDistrict), b: Math.max(r.aDistrict, r.bDistrict), heat: h, lastRun: r.lastRun });
    });
    const byName = new Map(state.tributes.map(t => [t.id, t] as const));
    Object.entries(allKillLedgers(state)).forEach(([killerId, kills]) => {
        const killer = byName.get(killerId);
        if (!killer) return;
        kills.forEach(k => {
            if (k.district === killer.district) return;
            const pk = pairKey(killer.district, k.district);
            const cur = heat.get(pk) ?? { a: Math.min(killer.district, k.district), b: Math.max(killer.district, k.district), heat: 0, lastRun: run };
            cur.heat += 1;
            cur.lastRun = run;
            heat.set(pk, cur);
        });
    });
    L.rivalries = [...heat.values()]
        .sort((p, q) => q.heat - p.heat || p.a - q.a || p.b - q.b)
        .slice(0, W.rivalries.maxRivalries)
        .map(r => ({ aDistrict: r.a, bDistrict: r.b, heat: Math.round(r.heat * 10) / 10, lastRun: r.lastRun }));

    // Nemeses: a victor who killed their way to the crown.
    const nemeses = (L.nemeses ?? []).filter(n => run - n.run < W.rivalries.nemesisRuns);
    winners.forEach(w => {
        const kills = killLedgerOf(state, w.id);
        if (kills.length < W.rivalries.nemesisKills) return;
        nemeses.unshift({
            name: givenName(w.name), district: w.district, kills: kills.length, run, arenaName: state.arena.name,
            victimDistricts: [...new Set(kills.map(k => k.district).filter(d => d !== w.district))].sort((a, b) => a - b),
        });
    });
    L.nemeses = nemeses.slice(0, W.rivalries.maxNemeses);

    // Arena mastery.
    const mastery = { ...(L.arenaMastery ?? {}) };
    const m = mastery[key] ?? { runs: 0, crowns: 0, longest: 0, victors: [] };
    mastery[key] = {
        runs: m.runs + 1,
        crowns: m.crowns + (winners.length > 0 ? 1 : 0),
        longest: Math.max(m.longest, state.day),
        victors: [...winners.map(w => givenName(w.name)), ...m.victors].slice(0, AUDIT12_WAVE3.mastery.victorsKept),
    };
    L.arenaMastery = mastery;

    // The museum: this arena's signature deaths, then its rarest non-tribute ones.
    const dead = state.tributes.filter(t => t.status === 'dead');
    const signature = dead.filter(t => t.lastDamage?.signature);
    const arenaKind = dead.filter(t => !t.lastDamage?.signature && CAUSE_FAMILY[deathCodeOf(t)] !== 'tribute' && CAUSE_FAMILY[deathCodeOf(t)] !== 'unknown');
    const pieces: MuseumPiece[] = [...signature, ...arenaKind].slice(0, 2).map(t => ({
        name: t.name, district: t.district, cause: t.causeOfDeath ?? 'unknown', code: deathCodeOf(t), day: t.dayOfDeath ?? state.day, run,
    }));
    if (pieces.length > 0) {
        const museum = { ...(L.museum ?? {}) };
        museum[key] = [...pieces, ...(museum[key] ?? [])].slice(0, AUDIT12_WAVE3.museum.perArena);
        L.museum = museum;
    }

    // Story chain progress, kept per arena.
    if (s.story) {
        const prior = L.storyChains?.[key];
        const done = s.story.step >= W.story.steps;
        L.storyChains = {
            ...(L.storyChains ?? {}),
            [key]: { chainId: s.story.chainId, step: done ? 0 : s.story.step, run, completed: (prior?.completed ?? 0) + (done ? 1 : 0) },
        };
    }

    // Seasons: points per district, a champion every `length` Games, and the
    // next season's card drawn a season ahead.
    const season = L.season ?? { number: 1, played: 0, points: {} };
    const pts = { ...season.points };
    const add = (d: number, v: number) => { pts[d] = Math.round(((pts[d] ?? 0) + v) * 10) / 10; };
    winners.forEach(w => add(w.district, W.season.crownPoints));
    finishingOrder(state.tributes).slice(winners.length, 3).forEach(t => add(t.district, W.season.finalistPoints));
    state.tributes.forEach(t => { if (t.kills > 0) add(t.district, t.kills * W.season.killPoints); });
    let next = { ...season, played: season.played + 1, points: pts };
    if (!next.nextMutator) next.nextMutator = drawMutators(`season-${next.number + 1}-${state.seed}`, 1)[0];
    if (next.played >= W.season.length) {
        const champ = Object.entries(pts).sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]))[0];
        next = {
            number: season.number + 1, played: 0, points: {},
            mutator: next.nextMutator,
            nextMutator: drawMutators(`season-${season.number + 2}-${state.seed}`, 1)[0],
            champions: [...(champ ? [{ number: season.number, district: Number(champ[0]) }] : []), ...(season.champions ?? [])].slice(0, 10),
        };
    }
    L.season = next;

    // The prediction bankroll and streak, across saves.
    if (x.slip) {
        const bank = L.predictionBank ?? { bankroll: W.prediction.bankrollStart, streak: 0, bestStreak: 0, upsetsCalled: 0, causeCalls: 0, overUnderCalls: 0 };
        bank.bankroll = Math.max(0, bank.bankroll - W.prediction.slipStake + x.slip.score);
        const sharp = x.slip.max > 0 && x.slip.score / x.slip.max >= PREDICTION.sharpShare;
        bank.streak = sharp ? bank.streak + 1 : 0;
        bank.bestStreak = Math.max(bank.bestStreak, bank.streak);
        if (x.slip.hits.includes('upset')) bank.upsetsCalled += 1;
        if (x.slip.hits.includes('first-death-cause')) bank.causeCalls += 1;
        if (x.slip.hits.includes('end-day')) bank.overUnderCalls += 1;
        L.predictionBank = bank;
    }
    if (x.upsetCalled) L.upsetRewards = (L.upsetRewards ?? 0) + 1;
    if (x.gauntletScore !== undefined && (!L.gauntletBest || x.gauntletScore > L.gauntletBest.score)) {
        L.gauntletBest = { score: x.gauntletScore, mutators: [...(state.config.mutators ?? [])], seed: state.seed, date: new Date().toISOString() };
    }

    // The Quell, announced a Games ahead: unrest at the Quell line after this
    // Games means the one after next is a Quell, and the next one is told so.
    const pending = L.announcedQuell;
    if (pending && pending.forRun <= run) delete L.announcedQuell;
    if (!L.announcedQuell && x.rebellion >= CAMPAIGN_ARC.quellAt && !state.gamesProfile?.quell) {
        const quell = new RNG(`${state.seed}-announced-quell-${run}`).pick(QUELLS);
        L.announcedQuell = { forRun: run + 2, quellId: quell.id, announcedAfter: run };
    }

    // Mentors: each crowned victor's own arena and best skill, for their successors.
    if (winners.length > 0) {
        const mentorArenas = { ...(L.mentorArenas ?? {}) };
        winners.forEach(w => {
            mentorArenas[w.district] = { arenaId: state.arena.id, arenaName: state.arena.name, terrain: dominantTerrain(state), bestSkill: bestSkillOf(w) };
        });
        L.mentorArenas = mentorArenas;
    }
    return L;
}
