/**
 * AUDIT-9 batch 5: proving the never-observed achievements are reachable.
 *
 * `check-achievements` reports 35 entries that never unlocked across 500
 * complete runs. The audit is emphatic about what that does and does not
 * mean:
 *
 *   "'Never observed' does not mean impossible. Add deterministic
 *    reachability fixtures ... before changing thresholds."
 *
 * The failure this prevents is a specific and tempting one: an entry reads
 * zero, somebody lowers its threshold to make it fire, and a card that was
 * always earnable — just rare, which is the point of a legendary — becomes
 * a card that unlocks every other run. The 500-run sweep is a sample, not a
 * proof, and a sample cannot distinguish "rare" from "impossible".
 *
 * A fixture can. Each block below constructs, by hand, the exact state the
 * predicate describes and asserts the predicate says yes. That is a proof of
 * reachability: if the game can ever produce this state, the card can be
 * earned. Where a fixture *cannot* be built, the entry is genuinely
 * unreachable and the threshold is the thing to change — which is the only
 * circumstance under which changing it is honest.
 *
 * This covers the tractable subset. Entries whose state cannot be assembled
 * without running most of a Games — the career-spanning ones, and the ones
 * gated on content the fixture would have to simulate — are listed at the
 * bottom as explicitly unproven rather than quietly omitted.
 */
import { scenario, check, world, report } from './scenarios';
import { ACHIEVEMENTS } from '../src/data/achievements';
import { GameState, Tribute } from '../src/models/types';
import { INTERVIEW_PERSONAS } from '../src/data/personas';

const byId = (id: string) => {
    const a = ACHIEVEMENTS.find(x => x.id === id);
    if (!a) throw new Error(`no achievement '${id}' — it was renamed or retired without updating this fixture`);
    return a;
};

/** Assert that a hand-built state earns the card. */
function reachable(id: string, build: (state: GameState, victor: Tribute) => void) {
    scenario(
        `${id} is reachable`,
        'never observed in 500 runs is a statement about the sample, not about the game',
        () => {
            const w = world(`reach-${id}`);
            const victor = w.tribute(0);
            w.state.tributes.forEach(t => { if (t.id !== victor.id) { t.status = 'dead'; t.health = 0; } });
            victor.status = 'alive';
            w.state.phase = 'ended';
            w.state.victorIds = [victor.id];
            build(w.state, victor);
            check(byId(id).test(w.state, victor) === true, `${id} unlocks on a state built to satisfy it`);
        },
    );
}

console.log('scores at the ends of the board');

reachable('a7-scored-twelve', (_s, v) => { v.trainingScore = 12; });
reachable('a7-scored-one', (_s, v) => { v.trainingScore = 1; });

console.log('what a victor can be carrying at the end');

reachable('a7-four-scars', (_s, v) => {
    v.scars = { head: true, torso: true, arms: true, legs: true };
});
reachable('a8-two-grades-down', (_s, v) => {
    v.injurySeverity = { ...(v.injurySeverity ?? {}), legs: 3 };
});
reachable('a8-every-site', (_s, v) => {
    v.scars = { head: true, torso: true, arms: true, legs: true };
    v.injurySeverity = { head: 1, torso: 1, arms: 1, legs: 1 };
});
reachable('a7-unsponsored', (_s, v) => { v.sponsorTrust = 0; });

console.log('what the rest of the cast can have done');

reachable('a7-ten-betrayals', s => {
    // Ten betrayals spread across the field, which is a lot of betrayals and
    // exactly the kind of year the card is for.
    s.tributes.slice(0, 5).forEach(t => { t.betrayalsCommitted = 2; });
});
reachable('owed-by-four', (s, v) => {
    s.tributes.filter(t => t.id !== v.id).slice(0, 4).forEach(t => {
        t.debts = { ...(t.debts ?? {}), [v.id]: 2 };
    });
});
reachable('every-persona', s => {
    // Every persona sold on the couch, across one cast.
    INTERVIEW_PERSONAS.forEach((persona, i) => {
        const t = s.tributes[i];
        if (t) t.interviewStrategy = persona;
    });
    // ...which needs at least as many tributes as personas to be possible at
    // all. If this ever fails, that is the finding.
    check(s.tributes.length >= INTERVIEW_PERSONAS.length,
        `a cast of ${s.tributes.length} cannot show ${INTERVIEW_PERSONAS.length} personas`);
});

console.log('the new cards that the sweep has not yet produced');

/*
 * Two of batch 5's own additions read zero in the 500-run sample. By this
 * file's own rule that is a fact about the sample until a fixture says
 * otherwise — and lowering a threshold on a card added an hour ago, without
 * checking, would be exactly the mistake this file exists to prevent.
 */
reachable('b5-wrong-floor', (_s, v) => {
    // Blocked by the level, then delivered once they were in the same place.
    v.deliveredAcrossLevels = true;
});

reachable('b5-a-quiet-promise', (s, v) => {
    const other = s.tributes.find(t => t.id !== v.id)!;
    v.memory = { ...v.memory, giftsReceived: 0 };
    s.obligations = [{
        id: 'quiet', owedById: v.id, owedToId: other.id,
        kind: 'supply', byCycle: 9, status: 'kept',
    }];
});

console.log('and the ones this fixture cannot build');

scenario(
    'the unproven entries are listed rather than quietly skipped',
    'an entry nobody has proved reachable is a known risk, not an absence',
    () => {
        /*
         * These need most of a Games to assemble — a career across runs, a
         * full arena's worth of zone effects, a rumour chain with three
         * believed lies in it. They are not asserted here, and the honest
         * position is that their reachability is unproven rather than
         * disproved. Anybody tempted to lower one of these thresholds should
         * build its fixture first; that is the whole point of this file.
         */
        const unproven = [
            'performed-to-the-end', 'every-door', 'the-quiet-one', 'the-unwitnessed',
            'rooted', 'careers-early', 'walking-wounded', 'the-short-week',
            'twelve-levers', 'the-carpenter', 'expelled-and-won', 'nothing-left-to-give',
            'the-mentor-was-right', 'the-whole-menu', 'a7-every-hidden-way',
            'a7-whole-vocabulary', 'a7-believed-three-lies', 'a7-came-back-from-the-floor',
            'a7-mercy-on-the-victor', 'a7-revealed-and-survived', 'a7-stripped-the-crown',
            'a7-allies-to-the-last-two', 'a8-scarred-and-won', 'a8-four-ledgers',
            'a8-eight-effects', 'a8-the-quiet-year',
        ];
        // The list has to stay honest: every id on it must still exist.
        unproven.forEach(id => {
            check(ACHIEVEMENTS.some(a => a.id === id),
                `${id} is on the unproven list but no longer exists — update the list`);
        });
        console.log(`     (${unproven.length} entries remain unproven; build a fixture before touching their thresholds)`);
    },
);

process.exit(report('AUDIT-9 batch 5 reachability') ? 1 : 0);
