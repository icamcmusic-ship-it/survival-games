/**
 * AUDIT-11 §8/§12: prediction mode, director tastes, the campaign arc, legacy
 * names, stale-line selection and parlays — the pure parts, headless.
 *
 *   npm run test:replayability
 */
import { initialRunState } from './runInit';
import { Simulator } from '../src/engine/simulator';
import { DEFAULT_GAME_CONFIG, ARENAS } from '../src/data/constants';
import { GameState } from '../src/models/types';
import { scorePrediction, finishingOrder, firstDeathOf, topKillersOf } from '../src/engine/prediction';
import { foldCampaignArc, applyCampaignArc, capitolCruelty, campaignSponsorMultiplier, givenName, legacyReapingDue, rebellionCallsQuell, rebellionOf } from '../src/engine/campaign';
import { directorTaste, weightedIndex } from '../src/data/directors';
import { HEAD_GAMEMAKERS } from '../src/data/gamemakers';
import { lineHash } from '../src/utils/lineHash';
import { decodeCampaignResult, encodeCampaign } from '../src/utils/campaignLink';
import { CAMPAIGN_ARC } from '../src/data/balance';
import { scenario, check, eq, report } from './scenarios';
import { chapterChipFor } from '../src/engine/season/surfaced';
import { STORY_CHAIN_META } from '../src/data/replayCards';
import { STORY_CHAINS, chainFor } from '../src/engine/season/storyChains';
import { foldSeasonLedger } from '../src/engine/season/fold';
import { scenarioCast } from '../src/engine/season/scenarios';
import { driftedTier, victorReturnPool } from '../src/engine/season/replayability';
import { counterfactualChallenge } from '../src/engine/season/whatIfBranches';
import { snapshotState } from '../src/utils/snapshot';
import { dailyStreakOf } from '../src/utils/panemStorage';
import { weeklyRules } from '../src/data/replayHooks';
import { AUDIT12_WAVE3, AUDIT13_SIDE } from '../src/data/balance';
import { FRESH_CAMPAIGN } from '../src/engine/campaign';


function play(seed: string, mutate?: (s: GameState) => void): GameState {
    let state = initialRunState({ seed, arenaId: ARENAS[0].id, config: DEFAULT_GAME_CONFIG });
    mutate?.(state);
    const sim = new Simulator(state);
    let guard = 4000;
    while (state.phase !== 'ended' && guard-- > 0) {
        if (state.phase === 'setup') sim.processTraining();
        else if (state.phase === 'training' || state.phase === 'scores') sim.processInterviews();
        else if (state.phase === 'interviews') sim.startGames();
        else if (state.phase === 'bloodbath') sim.processBloodbath();
        else if (state.phase === 'epilogue') state.phase = 'ended';
        else if (!sim.processTurn()) break;
        state = sim.getState();
    }
    return state;
}

const outcome = (s: GameState) => s.tributes.map(t => `${t.id}:${t.status}:${t.kills}:${t.eliminationIndex ?? ''}`).join('|');

scenario('prediction: a perfect slip scores its maximum, an empty one nothing', 'AUDIT-11 §8/§12', () => {
    const s = play('PRED-1');
    const order = finishingOrder(s.tributes);
    const perfect = scorePrediction(s, {
        winnerId: order[0].id,
        firstDeathId: firstDeathOf(s.tributes)?.id,
        topKillerId: topKillersOf(s.tributes)[0]?.id,
        finalEight: order.slice(0, 8).map(t => t.id),
    })!;
    eq(perfect.score, perfect.max, 'perfect slip');
    check(perfect.hits.includes('winner') && perfect.hits.includes('final-eight'), 'hits recorded');
    eq(scorePrediction(s, {}), undefined, 'empty slip');
});

scenario('prediction: filling a slip does not change the Games', 'AUDIT-11 §8/§12', () => {
    const a = play('PRED-2');
    const b = play('PRED-2', st => { st.prediction = { winnerId: st.tributes[3].id }; });
    eq(outcome(a), outcome(b), 'same outcome');
});

scenario('stale lines: selection changes wording only, never outcomes, and is deterministic', 'AUDIT-11 §8/§12', () => {
    ['STALE-1', 'STALE-2', 'STALE-3'].forEach(seed => {
        const a = play(seed);
        const stale = Object.values(a.usedText ?? {}).flat().map(lineHash);
        const b = play(seed, st => { st.staleLines = stale; });
        const c = play(seed, st => { st.staleLines = stale; });
        eq(outcome(a), outcome(b), `${seed}: outcomes unchanged`);
        eq(b.log.map(l => l.text).join('\n'), c.log.map(l => l.text).join('\n'), `${seed}: wording deterministic`);
        check(a.log.map(l => l.text).join('\n') !== b.log.map(l => l.text).join('\n'), `${seed}: wording moved off stale lines`);
    });
});

scenario('directors: every Head Gamemaker has a taste; weightedIndex is one-draw and total', 'AUDIT-11 §8/§12', () => {
    HEAD_GAMEMAKERS.forEach(g => check(directorTaste(g.name).label.length > 0, g.name));
    const ids = new Set(HEAD_GAMEMAKERS.map(g => directorTaste(g.name).id));
    check(ids.size >= 5, `at least five distinct tastes (${ids.size})`);
    eq(weightedIndex(0, [1, 1, 1]), 0, 'low end');
    eq(weightedIndex(0.999, [1, 1, 1]), 2, 'high end');
    eq(weightedIndex(0.5, [0, 1, 0]), 1, 'zero weights skipped');
});

scenario('campaign arc: folds, bounds, effects, and link round trip', 'AUDIT-11 §8/§12', () => {
    const s = play('ARC-1');
    const arc = foldCampaignArc({ rebellion: 69, victorMentors: {} }, s, 5);
    check(arc.rebellion >= 0 && arc.rebellion <= CAMPAIGN_ARC.rebellionMax, 'rebellion bounded');
    Object.values(arc.districtReputation).forEach(v => check(Math.abs(v) <= CAMPAIGN_ARC.reputationMax, 'rep bounded'));
    eq(capitolCruelty(undefined), 1, 'no campaign, no cruelty');
    eq(campaignSponsorMultiplier(undefined, 1), 1, 'no campaign, no sponsor change');
    const snap = { runs: 6, victors: 5, rebellion: 80, districtReputation: { 12: 30 }, feuds: [{ aName: 'Ada', aDistrict: 1, bName: 'Bo', bDistrict: 2, run: 4 }] };
    check(rebellionCallsQuell(snap), 'high rebellion calls a Quell');
    check(capitolCruelty(snap) > 1, 'cruelty rises');
    check(legacyReapingDue(snap, 'x', true), 'Quell reaps a legacy tribute');
    check(!legacyReapingDue(undefined, 'x', true), 'no campaign, no legacy');
    eq(givenName('Rue Barley'), 'Rue', 'given name only');
    const back = decodeCampaignResult(encodeCampaign(snap));
    check(back.status === 'ok', 'link decodes');
    if (back.status === 'ok') {
        eq(rebellionOf(back.snapshot), 80, 'rebellion survives link');
        eq(back.snapshot?.feuds?.length, 1, 'feud survives link');
    }
    const cast = play('ARC-2').tributes.map(t => ({ ...t, status: 'alive' as const, relationships: {} as Record<string, number> }));
    const d1 = cast.find(t => t.district === 1)!;
    const d2 = cast.find(t => t.district === 2)!;
    const lines = applyCampaignArc(snap, cast, (a, b, r) => { a.relationships[b.id] = r; b.relationships[a.id] = r; });
    check(lines.some(l => l.text.includes('Ada')), 'feud announced');
    eq(d1.relationships[d2.id], CAMPAIGN_ARC.feudRegard, 'feud regard applied');
});

/* -------------------------------------------------------------------------- */
/* AUDIT-13 §11/§12                                                            */
/* -------------------------------------------------------------------------- */

scenario('P4: a commentator re-skins the wording and never the Games', 'AUDIT-13 P4', () => {
    const a = play('VOICE-1');
    const b = play('VOICE-1', st => { st.config = { ...st.config, commentator: 'archivist' }; });
    eq(outcome(a), outcome(b), 'same outcome under another voice');
    const gong = (s: GameState) => s.log.find(e => /^Gong\. \d+ tributes|^The gong is logged/.test(e.text))?.text ?? '';
    check(gong(b) !== '' && /logged|record begins/.test(gong(b)), `the archivist calls the gong: ${gong(b)}`);
});

scenario('P1: scenario cards apply at the reaping, deterministically, without re-rolling the cast', 'AUDIT-13 P1', () => {
    const base = play('CARD-1');
    const lone = play('CARD-1', st => { st.config = { ...st.config, scenario: 'lone-volunteer' }; });
    eq(lone.tributes.filter(t => t.volunteered).length, 1, 'exactly one volunteer');
    eq(lone.tributes.map(t => t.name).join(','), base.tributes.map(t => t.name).join(','), 'same cast');
    check(lone.log.some(e => e.text.startsWith('Scenario: The Lone Volunteer')), 'announced');
    const again = play('CARD-1', st => { st.config = { ...st.config, scenario: 'lone-volunteer' }; });
    eq(outcome(lone), outcome(again), 'replays exactly');
    const six = play('CARD-2', st => { st.config = { ...st.config, scenario: 'career-six' }; });
    check(scenarioCast(six).every(t => t.isCareer && t.volunteered), 'the six are volunteer Careers');
});

scenario('S1: the chapter chip names the chain the engine will play, and progress survives the key fix', 'AUDIT-13 S1', () => {
    eq(STORY_CHAIN_META.map(c => c.id).join(','), STORY_CHAINS.map(c => c.id).join(','), 'meta mirrors the chains, in order');
    const s = play('CHAIN-1');
    const chip = chapterChipFor(undefined, s.arena.mapId ?? s.arena.id);
    eq(chip.chain.id, chainFor({ ...s, season: undefined } as GameState).chain.id, 'fresh arena: same chain');
    eq(chip.chapter, 1, 'chapter 1');
    const saved = { [s.arena.name]: { chainId: 'the-cache-map', step: 2, run: 1, completed: 0 } };
    eq(chapterChipFor(saved, s.arena.id, s.arena.name).chapter, 3, 'old name-keyed progress is read');
    const L = foldSeasonLedger({ storyChains: saved }, { ...s, season: { story: { chainId: 'the-cache-map', step: 3, lastDay: 6 } } }, { run: 2, rebellion: 0 });
    check(L.storyChains?.[s.arena.mapId ?? s.arena.id] !== undefined && L.storyChains?.[s.arena.name] === undefined, 'moved to the id key');
    check((L.museum?.[s.arena.mapId ?? s.arena.name] ?? []).some(p => p.code === 'story-chain'), 'a finished chain enters the museum');
});

scenario('S7/P3/P6/P8: the season bankroll, legacy drift, draft and scars fold into the ledger', 'AUDIT-13 S7/P3/P6/P8', () => {
    const s = play('FOLD-13');
    const v = s.tributes.find(t => t.status === 'alive');
    s.draft = s.tributes.slice(0, 4).map(t => t.id);
    const slip = { score: 10, max: 20, hits: ['winner'] };
    let L = foldSeasonLedger(undefined, s, { run: 1, rebellion: 0, slip });
    eq(L.seasonBank?.buyIn, AUDIT13_SIDE.seasonBuyIn, 'first slip buys in');
    eq(L.seasonBank?.net, 10 - AUDIT12_WAVE3.prediction.slipStake, 'net is score less stake');
    for (let run = 2; run <= AUDIT12_WAVE3.season.length; run++) L = foldSeasonLedger(L, s, { run, rebellion: 0, slip });
    eq(L.seasonBank, undefined, 'a closed season clears its bank');
    eq(L.seasonBoard?.length, 1, 'and writes the leaderboard');
    if (v) check((L.legacyDrift?.[v.district] ?? 0) > 0, 'the crowned district drifts up');
    eq(L.draftsPlayed, AUDIT12_WAVE3.season.length, 'every draft counted');
    check((L.draftBest?.max ?? 0) > 0, 'best draft kept');
    const wipe = { ...s, tributes: s.tributes.map(t => ({ ...t, status: 'dead' as const })) };
    const scarred = foldSeasonLedger(undefined, wipe, { run: 7, rebellion: 0 });
    eq(scarred.arenaScars?.[s.arena.mapId ?? s.arena.id]?.[0]?.kind, 'wipeout', 'a wipeout scars the arena');
    eq(driftedTier(1, { 1: -2 * AUDIT13_SIDE.legacyTierStep }), 'modest', 'storied falls two tiers');
});

scenario('P8: a scarred arena warns the field on day one, and a ledger-less run is unchanged', 'AUDIT-13 P8', () => {
    const plain = play('SCAR-1');
    const key = plain.arena.mapId ?? plain.arena.id;
    const zone = plain.arena.zones[1]?.name ?? plain.arena.zones[0].name;
    const scarred = play('SCAR-1', st => { st.campaign = { ...FRESH_CAMPAIGN, ledger: { arenaScars: { [key]: [{ kind: 'override', zone, run: 3 }] } } }; });
    check(scarred.log.some(e => e.text.includes(`still scorched where the Gamemakers reached in during Games 3`)), 'the scar is told');
    check(!plain.log.some(e => /still scorched/.test(e.text)), 'no scar without a ledger');
});

scenario('S5/P5: daily streaks count consecutive dates; weekly rules are stable inside a week', 'AUDIT-13 S5/P5', () => {
    const row = (date: string) => ({ date, seed: `daily-${date}` });
    eq(dailyStreakOf([row('2026-09-26'), row('2026-09-25'), row('2026-09-24'), row('2026-09-20')], new Date(Date.UTC(2026, 8, 26, 12))), 3, 'three in a row');
    eq(dailyStreakOf([]), 0, 'none');
    const mon = weeklyRules(new Date(Date.UTC(2026, 8, 21)));
    const sun = weeklyRules(new Date(Date.UTC(2026, 8, 27, 23)));
    eq(JSON.stringify(mon), JSON.stringify(sun), 'same week, same rules');
    check(mon.mutators.length > 0, 'the weekly carries cards');
});

scenario('P2: the counterfactual challenge replays deterministically from the reaping', 'AUDIT-13 P2', () => {
    const reaping = initialRunState({ seed: 'CHAL-1', arenaId: ARENAS[0].id, config: DEFAULT_GAME_CONFIG });
    const sim = new Simulator(snapshotState(reaping));
    let guard = 4000;
    while (guard-- > 0 && sim.advance()) { /* to the end */ }
    const actual = sim.getState();
    const target = actual.tributes.find(t => t.status === 'alive')!;
    const pick = { cycle: 3, type: 'bounty', targetId: target.id };
    const a = counterfactualChallenge(reaping, actual, pick)!;
    const b = counterfactualChallenge(reaping, actual, pick)!;
    check(a !== undefined, 'a result');
    eq(JSON.stringify(a), JSON.stringify(b), 'deterministic');
    eq(a.actualVictorIds.join(','), [target.id].join(','), 'knows who really won');
});

scenario('P7: the victor-return pool is the most recent crowned, one per given name', 'AUDIT-13 P7', () => {
    const e = (id: string, winnerName: string, extra: Record<string, unknown> = {}) => ({ id, winnerName, winnerDistrict: 1, arenaName: 'A', seed: id, kills: 1, date: 'd', ...extra }) as never;
    const pool = victorReturnPool([e('1', 'Rue'), e('2', 'Rue'), e('3', 'Cato & Clove'), e('4', 'Thresh', { noVictor: true }), e('5', 'Foxface')]);
    eq(pool.map(p => (p as { winnerName: string }).winnerName).join(','), 'Rue,Foxface', 'deduped and filtered');
});

process.exit(report('replayability') > 0 ? 1 : 0);
