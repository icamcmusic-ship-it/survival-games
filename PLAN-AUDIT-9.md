# AUDIT-9 implementation plan

The companion to `AUDIT-9.md`. That document is the audit; this one is what we
are doing about it, in what order, and what has to be true before each step is
allowed to count as done.

**Status:** batches 1 and 2 are implemented and merged (commit "AUDIT-10
batches 1 and 2"). Batches 3–5 below are planned, not built.

The audit's own framing governs the whole plan and is worth restating, because
it is the thing most easily lost once implementation starts: *the game already
has substantial breadth.* 45 arenas, 184 traits, 36 archetypes, 398
achievements, 4,238 names. The opportunities are reliable reporting, consistent
physical rules, stronger consequences for social decisions, and better
selection of the content that already exists. Every item below is either a
repair, a consistency pass, or a deepening of an existing interaction. Nothing
here is "add more nouns".

---

## Done — batch 1: trust the result

B01–B09, plus `runDelta`'s cast-size confound. The exit criterion the audit
sets is *the same run has the same truthful outcome in UI, export, achievements,
career records and metrics*, and that is what these were: nine places where the
simulation knew the right answer and something downstream reported a different
one.

| ID | What it was | Measured effect of the repair |
|---|---|---|
| B01 | `dayOfDeath === 0` is unsatisfiable; the bloodbath runs on day 1 | 102 false "nobody died at the Cornucopia" highlights in 120 runs → 0, over 920 real horn deaths |
| B02 | Same mistake in the early-favourite line | The line can now fire at all |
| B03 | Two achievements, one advertised condition, two predicates | Predicates untouched (no migration); the claims now match what is measured |
| B04 | `isStarCrossed(victor)` treated as proof the partner died | A dual win in love is no longer told one of them is dead |
| B05 | The "largest pack" notable read the live registry | 119/120 runs had a pack of 5+; 0 still had one at the end. Now read from a durable chronicle |
| B06 | The vengeance line matched the *oath* prefix | Sworn 120/120, paid 32/120. The line now fires on the 32 |
| B07 | Every export took the first living tribute as victor | Unfinished exports say in progress; dual wins name both; no "The The … Games" |
| B08 | One survivor did outcome, crowns, mentors and patronage | Three separate questions, separately answered |
| B09 | Metrics credited only the first survivor | Co-winners no longer silently dropped from win-rate numerators |

## Done — batch 2: consistent mechanics

B10–B16. Exit criterion: *focused failure fixtures pass; resume preserves the
result; baseline scenario and soak checks remain green.*

Work now carries its site (B10) and cannot spend negative time (B11).
Promises are kept in person, using the same `samePlace` check the rest of the
engine uses (B12), and a handover is a transfer that can fail (B13). Stacks
merge only where their metadata agrees, so food cannot be made fresher by
arriving in the right order (B14). Hard event gates are filtered once with no
fallback that restores them (B15). The text-size preference reaches the ~200
labels that were written in fixed pixels (B16).

Evidence: `npm run test:audit10` — 23 fixtures, each one an audit reproduction
turned around. Plus soak (400 runs, no invariant violations), scenarios 27/27,
all static checks, build.

---

## Done — batch 3: balance and readability

**Result: the twelve unmet design indicators are nine, all regression guards
hold, and three of the misses the audit named are closed.**

Measured at `METRICS_RUNS=1600`, every archetype over 500 entrants:

| Indicator | Audit §9 | Re-baselined | **After batch 3** | Goal |
|---|---:|---:|---:|---|
| Best/worst archetype ratio | 3.24× | 3.12× | **2.29×** | ≤2.3× **MET** |
| Career archetype win rate | 9.06% | 9.17% | **7.93%** | ≤8% **MET** |
| Reaping-trait win spread | 4.35× | 2.93× | **1.90×** | ≤2.5× **MET** |
| Confessor | 2.79% | 2.99% | **5.39%** (n=501) | ≥3.5% cleared |
| Zealot | 3.07% | 2.94% | **3.83%** (n=783) | ≥3.5% cleared |
| Broker | 3.28% | 3.28% | **4.28%** (n=1005) | ≥3.5% cleared |
| Career share of winners | 51.0% | 51.2% | **49.4%** | ≤45%, unmet |
| Scavenging stance share | 1.3% | 1.3% | **1.7%** | ≥1.5% cleared |
| Worst archetype | 2.79% | 2.94% | **3.46%** (Forecaster) | ≥3.5%, 0.04pp short |

Two honest notes on that table. The **rarest stance** indicator is still
unmet at 1.3% — Scavenging cleared its goal and the indicator now tracks
*Patrolling*, a different stance that this batch did not touch. And the
**worst archetype** row is still unmet for the same reason: none of the three
the audit named is the worst any more, and the new floor-holder is the
Forecaster, which was never diagnosed here.

**How, and why it matters that it was done this way.** Every one of those
movements came from an opportunity or correctness fix. Not one stat was
raised, and no archetype was given a survival subsidy — which was the audit's
explicit warning ("Do not give a new archetype a flat survival subsidy to
conceal that its core action rarely becomes legal", and for the existing ones,
"an opportunity problem does not get better by enlarging the bonus").

The diagnosis step is what made that possible, and it contradicted the obvious
guesses in all three cases:

- **Zealot** was not short of opportunity. It died at the Cornucopia — 44.2%
  of its deaths at the horn against a field near a third — with
  *above-average* company. Fixed with a declared creed, not a health buff.
- **Confessor** had the **most** company in the game (13.38 others in the
  zone, alone in only 3.8% of cycles) and still lost. It was surrounded by
  people it had no way to ask for anything, because every promise in the game
  required an alliance.
- **Career**'s edge was the *lowest* horn death rate in the game (23.5%), not
  superiority in the fight. It dies of body causes more than combat, which is
  the intended design working.

`scripts/diagnose-archetypes.ts` is the instrument, kept, with Wilson
intervals. `npm run test:batch3` asserts each mechanism as a positioned scene,
because a win rate cannot say whether a mechanism fires — and at the
archetype sample sizes a 400-run sweep gives (n≈145), it cannot say much at
all: four consecutive measurements of the Confessor read 2.07 / 3.45 / 2.07 /
1.38%, every interval overlapping every other.

### The browser pass

`npm run test:textscale`, in CI. Four text settings × two viewports, driven
into a live run rather than taken on the setup screen — because the dense
labels B16 was about do not exist until the Games have started.

It found three real defects that B16's single-viewport measurement had missed:
29px of horizontal overflow at "larger" on a 380px phone, the chronicle
day-picker pushed outside the viewport, and `text-nano` rendering at 8.1px at
"small". All three fixed and re-verified. This is why the audit's browser
limitation mattered, and it is now closed.

### Still open from batch 3

- **Career share of winners** at 49.4% against a 45% goal. Moving, not met.
- **Patrolling and Tending** were left alone. Their eligibility gates need
  opportunity design of their own and this batch had no diagnosis for them;
  changing them on the strength of the Scavenging result would be guessing.
- **Training scores ≥9** at 23.5%, unchanged. It is in the audit's Career
  compounding list, but the lever is global rather than Career-specific and
  moving it would have confounded everything else measured here.
- **Forecaster** at 3.46% is now the floor-holder, 0.04pp short. It has never
  been diagnosed; it should get the same treatment the other three did rather
  than a nudge.

## Batch 3 — the original plan

**Goal:** move the twelve unmet design indicators, on numbers we can now trust,
and finish the readability work the text-scale fix started.

**Sequencing matters here and is the first thing to get right.** B09 means the
1,600-run sweep in the audit undercounted co-winners, so *every* archetype,
district and trait win rate in section 9 is provisional. The correct first step
is not to tune anything.

1. **Re-baseline.** ~~Re-run the sweep on corrected counting and publish the new
   table beside the old one.~~ **Done** — run at `METRICS_RUNS=1600` on
   corrected counting, all regression guards holding. The sweep now reports
   **1,634 people crowned across 1,599 Games with a victor (35 dual)**, which is
   the B09 undercount stated plainly.

   The prediction that some gaps would move without a balance change holds, and
   one of them moved enough to redirect the work:

   | Indicator | Audit (§9) | Re-baselined | Note |
   |---|---:|---:|---|
   | Best/worst archetype win ratio | 3.24× | **3.12×** | goal ≤2.3×, still unmet |
   | Career win rate | 9.06% (n=1,778) | **9.17%** | goal ≤8%, still unmet |
   | Confessor | 2.79% (n=501) | **2.99%** | no longer the worst archetype |
   | Zealot | 3.07% (n=783) | **2.94%** | **now the worst**, and the floor case |
   | Broker | 3.28% (n=1,005) | **3.28%** | unchanged |
   | Career share of winners | 51.0% | **51.2%** | goal ≤45%, still unmet |
   | Training ≥9 | 23.5% | **23.5%** | unchanged |
   | Stranger final-two standoffs | 35.4% | **35.5%** | unchanged |
   | Time at sanity floor | 19.4% | **19.4%** | unchanged |
   | Zero-kill winners | 7.8% | **8.5%** | now per person crowned, not per run |
   | Rarest stance (Scavenging) | 1.3% | **1.3%** | unchanged |
   | Typical duration | 10.33 days | **10.34** | unchanged |

   **Confessor and Zealot swapped places.** The audit's step 3 names Confessor
   as a floor case and Zealot as needing a disengagement condition; on corrected
   counting Zealot is the one under the floor and Confessor is above where
   Zealot was. Neither changed; the measurement did. That is the whole argument
   for re-baselining before tuning, and it means step 3 below is now ordered
   Zealot first.

   Signature rates are unaffected (they are per entrant and never read the
   winner): all 36 clear the 29% floor, five still short of the 35% target —
   Cartographer 32.6%, Bellwether 32.1%, Courier 31.3%, Captor 29.8%, Broker
   29.3%.
2. **Diagnose before adjusting.** For each weak archetype (Confessor 2.79%,
   Zealot 3.07%, Broker 3.28%), break losses down by phase, arena, district,
   age and loadout, and count *signature opportunities before death*. The
   audit's hypothesis — that a weak archetype may be dying before its signature
   ever becomes legal — is testable and changes the fix entirely: an
   opportunity problem does not get better by enlarging the bonus.
3. **Social archetypes get opportunities, not buffs.** Re-ordered by the
   re-baseline above: **Zealot first**, since it is now the archetype under the
   floor — an intentional disengagement condition rather than flat health.
   Then Broker, which needs reliable negotiating situations and has the least
   margin of any signature (29.3% against a 29% floor). Confessor last; at
   2.99% it is close to the 3.5% floor rather than far below it. Throughout,
   guard against the failure mode where a social role is only valuable when
   everyone nearby is already friendly.
4. **Career compounding, selectively.** Starting attributes, equipment,
   training, alliance formation and sponsors each currently assume the others
   provide no advantage. Reduce the stacking, not the dangerous opening.
5. **Stances.** Evasive 36.2% / Aggressive 26.1% / Defensive 14.0%, with nine
   sharing 23.7%. The question to answer is *why would anyone choose
   Patrolling, Tending or Scavenging* — an opportunity-and-consequence
   question, not a weight question. Equal use is explicitly not the goal.
6. **Traits: do not tune from the census.** The 4.35× reaping-trait spread is
   confounded — traits correlate with district and archetype, and earned traits
   are survival-selected. Only 27 of 155 starting-trait rows clear 500
   entrants. Any trait change requires matched casts and labelled RNG streams
   so that changing a trait does not shift the whole draw sequence, with
   confidence intervals reported.

Readability, in the same batch:

- Evidence-backed end summary: every highlight opens the exact event, phase and
  people supporting it. `allNotables` already separates derivation from
  selection, which is the hook for this. Invalid or unknown facts stay omitted —
  B01's "unknown rather than zero" is the pattern.
- Category diversity in selection, so the three shown are not three versions of
  one story.
- Distinguish "notable moments" from "unusual compared with your last Games".
  The latter needs a real historical baseline; several current lines are
  threshold flavour the UI describes as measured history.
- Browser and phone validation. The audit could not launch a browser, so every
  UI finding in it is static. This batch is where that stops being true: the
  largest text setting and browser zoom at phone width, no clipped actions.

**Exit:** target movement reported *with sample sizes and intervals*; a
completed browser/phone pass rather than a static check standing in for one.

## Done — batch 4: three deep content pilots

All three built, each measured, each with fixtures in `npm run test:batch4`.

| Pilot | What it is | Measured |
|---|---|---|
| **Rescue line** | A stranded person, an anchor of knowable quality, and three distinguishable failures — bad anchor, excess load, deliberate cutting | 182 of 200 runs have one; clean 244 / anchor-failed 290 / overloaded 23 / cut 23; 338 follow-up beats; 11 deaths |
| **The argument about the food** | A group too short to go round decides *how* to be short: equally, by contribution, or by need. Non-fatal by construction | 36 disputes per 400 runs, all three splits used, 35 lost-side beats, 31 follow-ups |
| **The tide** | The Tempest Reach's signature moved onto the forecast system: warning → source → growth → mitigation → impact → aftermath | 41 strikes, 73 mitigations, 70 averted, 88 flood aftermaths per 150 runs |

**The gate caught two dead branches**, which is the thing it exists for. The
rescue line's `cut` fired 0 times in 200 runs because the rescuer was selected
as the friendliest person present — a selection rule that quietly guarantees
somebody who wants the rescue to work. And `rigged` fired 0 times because it
gated on climbing proficiency, which 69.1% of tributes end a run at zero. Both
were found by measuring, not by reading the code.

**The aftermath stage did not exist for water at all.** Fire already burned out
into stripped ground; a flood simply stopped. That was the whole of the audit's
"opportunity after damage" point, unbuilt — hazards changed health and never
changed anybody's reasons.

Also caught here, by `check-achievements` on this batch's sample: two pairs of
cards unlocking on exactly the same runs. Both predicates predate this work;
the check could not see them until there were enough observations to cross its
threshold. `it-changed-hands` promised one thing and tested another, and
`one-wound`/`scarred-and-standing` are B03's defect a third time — merged, with
the unlocks migrated.

## Batch 4 — the original plan

Three chains, not twelve. The audit is specific that the minimum useful package
is setup → choice → consequence → remembered result, and that twelve new
independent death rolls per cycle is the failure mode to avoid. Overall
lethality stays where it is; these *substitute* for generic resolutions rather
than stacking on top of them.

1. **A universal rescue chain** — "rescue line failure" from section 7. A
   stranded person, a suitable anchor, an attempted extraction. Distinguish bad
   anchor, excess load and deliberate cutting, because those are three
   different stories and one of them is a betrayal. Non-fatal branch: the
   rescue costs the rescuer something they were carrying.
2. **An alliance dispute chain** — a scarcity vote. What was contributed and
   what was consumed, an expensive rescue or an unequal ration split put to the
   group, decided against need and charter terms, with the losing side's
   response recorded. Non-fatal by construction; the consequence is political.
3. **An arena environmental chain** — one authored signature built on the
   existing forecast system rather than a parallel warning mechanism. Warning →
   source → growth → mitigation → impact → aftermath, with the aftermath
   changing the terrain's incentives (receding flood exposes salvage).

Each needs: prerequisite tags, a warning or inferable risk, an avoidance
option, structured attribution, at least one non-fatal outcome, and a follow-up
one or two cycles later that reads the actual result.

**Exit:** each chain has warning/choice/consequence, a non-fatal branch,
durable records, and — now guaranteed by B15 — no fallback path that can fire
it when its preconditions do not hold.

## Batch 5 — replay and catalogue growth

Only after 3 and 4. In rough priority:

- **Versioned daily challenge**: same seed, rules, content version and campaign
  mode for every participant. A seed alone is not a replay specification; the
  export manifest (engine/content version, base and resolved config, arena
  identity, campaign snapshot, interventions) is the prerequisite.
- **Scenario starts**: separated allies, a damaged crossing, a contested
  medical cache. These exercise existing mechanics and stay *out* of the
  balance baseline.
- **Counterfactual replay** from a checkpoint, labelled as an alternate run,
  never overwriting the original archive.
- **Remaining arena briefs** from section 6, each with three authored outcomes
  (successful adaptation, costly survival, lethal failure).
- **Achievements**: the strongest 8–12 of the 24 candidates, with trigger
  fixtures, near-miss text and migration behaviour. Not all 24 — the count is
  not the point, and B03 is the standing proof that a large catalogue can
  contain two entries for one idea. Before any of them: deterministic
  reachability fixtures for the 32 never-observed entries, because "never
  observed in 500 runs" is not "impossible" and is not grounds for changing a
  threshold.
- **Names**: the 96 screened candidates, allocated by sound and district theme,
  with the existing no-duplicate and cross-pool checks re-run afterward and a
  separate mentor dedup pass. **Single given-name field. No surname pool, no
  surname generator, no suffix, no toggle, no hidden surname metadata.**
  Duplicate display names resolve through district badges and internal IDs.
- **Trait and archetype pilots**: start with two archetypes, not four. Gate each
  on demonstrated behavioural distinction and signature opportunities *before
  death* — never a flat survival subsidy concealing that the core action rarely
  becomes legal. Several of the sixteen traits should begin as learned
  tendencies rather than permanent reaping bonuses.

---

## Deferred, with reasons

Not everything in the audit belongs in a batch yet.

- **Bundle size** (2.82 MB / 785 kB gzip main chunk). This is a measurement, not
  a measured delay. Before splitting anything: find out why setup imports retain
  the large content tables, and measure cold start on a slow phone. A worker for
  simulation batches only after profiling shows main-thread stalls, and only
  with a cancel action and deterministic checkpoints.
- **The 17 ESLint warnings.** Review items, not 17 bugs. Fix the genuine
  stale-effect and ref-mutation cases; do not globally suppress.
- **`planArenaEvents()` spacing collisions.** First decide whether day spacing
  is a hard rule or a preference, then either allocate valid calendar slots or
  describe it honestly. Ambiguity is the actual defect.
- **`repayDebts()` fixating on the largest debt before checking the creditor is
  reachable.** Decide whether stubbornness is intended personality before
  "fixing" it into a universal policy.
- **Obligation lifecycle ledger.** The 400-run soak's 521 made / 46 kept / 19
  broken / 208 lapsed are event counts, not a reconciliation, and the remainder
  is not established to be a bug. Build the closing ledger (still-open,
  end-of-games cancellation, death, expiry, success) *first*, then tune
  acceptance toward promises that can actually be attempted. B12 and B13 will
  have moved these numbers already.

## Standing release checks

Unchanged from the audit, and they apply to every batch above: deterministic
seeded replay, save/resume equivalence, item and time conservation, valid
winner accounting, semantic achievement uniqueness, hard event eligibility, and
historical summaries supported by recorded facts.

One rule the whole plan depends on: **a large passing test roster is not a
substitute for the focused failure example.** `check-audit10.ts` is the shape —
put the world in the position that produced the wrong answer, and assert the
right one.
