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

process.exit(report('replayability') > 0 ? 1 : 0);
