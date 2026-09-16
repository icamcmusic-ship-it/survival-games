# Survival Games — fourth full audit (11 sections)

## Context

Taken against `main` at `2f942f6`, after `AUDIT.md`, `AUDIT-2.md`, `AUDIT-3.md`
and the three fix passes recorded in `CHANGELOG.md`. Written to the eleven
headings the request named. **Nothing below is merged into a neighbouring
section** — where a finding belongs in two places it is stated twice, in each
section's own terms.

Every number here was measured on this commit, either by the repository's own
check roster or by four throwaway probes written against `Simulator`'s public
API and deleted afterwards. Where this report says "never", it means a counter
that stayed at zero across a stated number of complete runs.

### The check roster, on this commit

| check | result |
|---|---|
| `lint` | clean |
| `test:sim` (400 runs) | passes, no invariant violations |
| `test:metrics` (400 runs) | 23/23 regression guards hold |
| `test:metrics` (1,600 runs) | **22 of 23 indicators meet their design goal** |
| `test:decisions` (40 runs, 5,657 tribute-cycles) | passes |
| `test:achievements` (500 runs) | passes; 6 never unlock, **0 rarity labels drifted** |
| `test:arenas` | passes; 40 authored arenas + 12 procedural biomes, 47 mutt rosters |
| `test:flavor` | passes; 0 pools under floor, 0 under target |
| `test:knobs` | 2,073 knobs across 129 groups, all referenced |
| `test:undeclared-knobs` | no new drift; 87 baselined sites remain |
| `test:names` | 3,200 names + 204 mentors; 191 names in two pools |
| `test:predicates` | clean; 53 optional booleans, 192 achievement reads |
| `test:zone-features` | 415/415 zones author an interior |
| `test:storage` | 15/15 migration cases pass |
| `test:arena-layout` | 160 layouts, no collisions, 46px touch targets |
| `test:ui-affordances` | 31 hover-only hints (at ceiling) |

**This is the healthiest the repository has been across four audits.** The
previous report's three headline findings are genuinely closed: the five dead
enum members are constructed, all 1,449 arena events carry derived ids, and the
archetype balance guard now prints the whole field. At 1,600 runs the
whole-field archetype spread is **1.92x** against a goal of ≤2.3x, and the
worst archetype is **3.82%** against a goal of ≥3.5%. Both were short at the
last audit.

There is no crash in this report, and no invariant violation. The failures
found this time fall into four kinds:

1. **The same taxonomy bug, in a file the last three audits did not open.**
   `EdgeRule` declares seven kinds. One of them (`contested`) exists on
   **one edge in one arena out of forty**, and the ~60 lines of garrison engine
   built on it fired **zero times in 160 runs**. Three more kinds are on five
   edges between them. §1.1.
2. **A UI predicate comparing an id against a list of names.** The "Returning
   victor" chip can never render. §1.2.
3. **A distribution nobody has looked at.** 31.4% of all live tribute-cycles
   are spent at sanity 0–9 and 31.3% at 90+; the four middle deciles together
   are 20%. Sanity is the largest single category of feed line in the game
   (12.9%) and it is effectively a two-state flag. §3.2.
4. **Guards that measure the sweep rather than the thing.** `test:sim` reports
   "695/1,388 authored events fired at least once (50.1%)" and it reads like a
   content problem. It is a run-count artifact: at 120 runs on one arena the
   reach is **94–100%**. §1.5.

### The probes

Four scripts were written against `Simulator`, run, and removed.

- **A** — 180 complete runs across all 41 arena ids and four configs, sampled
  **every cycle** (3,603 state-samples, 31,840 tribute-cycles) plus an
  end-state census of all 3,420 tributes.
- **B** — 200 complete runs, per-cycle sampling of the things that are pruned
  before the end (feast theme, live vengeance pacts, bloc treaties), plus
  proficiency growth, log-category shares and per-run event reach.
- **C** — 160 complete runs (28,811 tribute-cycles): movement, zone occupancy,
  the downed state, sanity bands, edge crossings, garrisons.
- **D** — 120 runs each on four fixed arenas, to find the *ceiling* of authored
  event reach rather than the sweep's sample-limited figure.

A note on instruments, because this report made the mistake once. Probe A read
`state.feastTheme` at the end of a run and reported it absent in 90.6% of runs.
That is not a finding; `processFeast` clears the field on the way out. Probe B
sampled it per cycle and found all **eight** themes drawing evenly (food 95,
tokens 91, medical 85, empty 84, single-pack 77, weapons 70, district-gifts 70,
fieldcraft 64 over 200 runs). The feast theme system is in good health. This is
the third audit running to make an end-state-census error, and §1.10 proposes
the fix.

---

## §1 — All bugs

Ordered by consequence. None is a crash; the roster is green and stays green
with all of them present, which is the point.

### 1.1 The `EdgeRule` taxonomy has four near-dead members and one dead subsystem

`models/types.ts:1642` declares seven edge kinds. Across all forty authored
arenas:

| kind | authored instances | procedural |
|---|---|---|
| `tolled` | 26 | yes |
| `timeGated` | 8 | yes |
| `oneWay` | 5 | yes |
| `collapsing` | **4** | never |
| `hidden` | **2** | never |
| `contested` | **1** | never |
| `oneWayAfter` | **1** | never |

Thirty-four of forty arenas carry any `edgeRules` at all, and **27 of those
carry exactly one**; only `redcathedral` (5), `culdesac`, `labyrinth` and
`kelvin` (3 each) treat the map's edges as a designed layer. Twenty-one of sixty procedural seeds carry any, and they
compose only three of the seven kinds.

What follows from `contested = 1`:

- `map.ts:780 tickGarrisons` runs once per cycle in every run in the game,
  iterates `contested` edges, finds none in 39 of 40 arenas, and returns.
- `map.ts:141 runGarrison` — the interception roll, the guard search, the
  forced-crossing fatigue and the two log lines — is reachable in one arena,
  on one edge, and only when an alliance member has held an adjacent
  chokepoint for `EDGE_RULES.garrisonHoldCycles`.
- **Measured: 0 garrisons claimed across 160 complete runs.** The state field
  `garrisonedEdges` is never non-empty.

What follows from `collapsing = 4` and `oneWayAfter = 1`:

- `map.ts:111 countCrossing` is the only writer of `state.edgeCrossings`, and
  it is called only on those two kinds. Five edges across forty arenas.
- **Measured: 0.0 edge crossings counted per run across 160 runs.** The rope
  bridge that spends itself — the mechanic the function's own comment calls
  "the counting *is* the mechanic" — has never been counted.

`hidden = 2` is the sole gate on `map.ts:705 tickHiddenEdges`,
`map.ts:761 tellAllyAboutEdge`, `map.ts:388`'s passability check and
`Tribute.knownEdges` — a discovery mechanic, an ally-briefing mechanic and a
per-tribute map memory, all standing on **two edges in two arenas**.
(`sharedIntelWith`, `liedTo` and `intelSold` are *also* written by
`memory.ts` and `parley.ts` for rumours and for paying a toll in information,
so those three are alive — 2.70 intel trades per run, measured — independently
of the edges. `knownEdges` is not.)

This is §1.2 and §1.3 of the last audit, one file over. The difference is that
last time the kinds could not be *constructed*; this time they can, and nobody
authored them. That is a content gap presenting as a dead subsystem, and the
fix is the same either way: a check that fails the build when an `EdgeRule`
kind has fewer than N instances across the roster, the way `trapKinds` now
fails when a trap kind reads zero.

### 1.2 The "Returning victor" chip can never render

`engine/veterans.ts:68` pushes `entry.winnerName` — a **name**:

```ts
seated.push(entry.winnerName);
```

`phases/pregames.ts:55` reads it back correctly (`cast.find(t => t.name === name)`),
and `screens/ReapingScreen.tsx:31` reads it correctly
(`new Set(gameState?.veteransSeated ?? [])` matched against names).

`components/TributeModal.tsx:369` does not:

```tsx
{gameState.veteransSeated?.includes(tribute.id) && (
    <span className="chip chip-gold" …>Returning victor</span>
)}
```

An id against a list of names. The chip has never rendered for anybody. The
Grudge Match feature's one piece of in-modal signposting is dead, and because
the badge is cosmetic nothing failed.

Two smaller things fall out of the same three lines. The chip is one of the
47 remaining `title=`-only hints (§2.2), and `pregames.ts` matching a veteran
by name is fragile in exactly the way ids exist to prevent — the soak asserts
name uniqueness within a cast, so it holds today, but it holds by luck.

### 1.3 The authored legendary-weapon name pool is unreachable

`engine/legendaryItems.ts:75`:

```ts
const composed = composeName(ctx, weapon, wielder).filter(n => !taken.has(n));
const available = LEGENDARY_ITEM_NAMES.filter(n => !taken.has(n));
const pool = composed.length > 0 ? composed : available;
```

`composeName` ends with an unconditional `out.push(\`District ${wielder.district}'s ${cap(weaponNoun)}\`)`,
so `composed` is never empty unless every one of its five candidates is already
taken in that run. The fixed pool is therefore the fallback to a branch that
effectively cannot be reached.

**Measured: 86 distinct legendary names across 180 runs. Not one of the
sixteen authored names appeared.** The pool is *Second Chance, The Debt,
Widow's Reach, The Understudy, Ninth Hour, The Long Answer, Nobody's, The
Inheritance, Quiet Sunday, The Argument, Last Tuesday, The Favour, Threadbare,
The Short Way, Anthem, The Standing Debt* — sixteen hand-written names, the
best flavour in the module, that no player has ever seen.

The composed names are good and should stay. The fix is to put the authored
pool *into* the candidate list rather than behind it, so a blade is sometimes
called The Argument and sometimes the Reef-Blade.

### 1.4 `${cap(arenaWord)}'s Answer` mis-forms the possessive on plural arenas

Same file, `legendaryItems.ts:49`. `composeName` takes the longest significant
word from the arena name and appends `'s Answer`. When that word is a plural,
the output is wrong English.

**Measured, in the probe A run census:** `Swamps's Answer`, `Fields's Answer`.
Both shipped to the feed, the chronicle and the record book. The same template
also produced `Terraces` and `Islands` arenas in the sample, so the class is
wider than the two observed.

One line: drop the `s` when the word already ends in one.

### 1.5 `test:sim`'s event-reach guard measures the sweep, not the reach

`scripts/soak.ts:26` sets `EVENT_REACH_FLOOR = 0.45` and the sweep reports:

```
arena events: 695/1388 authored events fired at least once (50.1%)
  thinnest reach: eclipse 8/33, frozen 11/33, seapeaks 11/33, saltflats 12/34
```

Read cold, that says half the authored arena content is unreachable. It is not.
The sweep runs 400 runs across 41 arena ids — **about ten runs per arena** — and
a run fires 3.7 to 8.0 of its own arena's 33 events.

Probe D ran 120 runs on each of four arenas:

| arena | pack | reached in 120 runs | per-run average |
|---|---|---|---|
| eclipse | 33 | **33 (100%)** | 6.7 |
| labyrinth | 33 | 32 (97%) | 8.0 |
| frozen | 33 | 32 (97%) | 3.7 |
| reef | 33 | 31 (94%) | 5.5 |

`eclipse`, the sweep's thinnest pack at 8/33, reaches **all 33** when it is
actually played. The number the soak prints is a function of `RUNS / arenaIds.length`,
which means it falls when somebody adds an arena and rises when somebody
raises the run count — the two changes a ratchet must not react to. It is the
wrong statistic wearing a guard.

Replace it with per-run reach (how much of its own pack an arena shows in one
Games — measurable, stable, and the number that actually describes the player's
experience) and keep the "no pack is entirely dead" assertion, which is sound.

### 1.6 The 400-run metrics report prints two goal failures that are not real

`npm run test:metrics` at its default 400 runs prints:

```
  spread (best/worst)   2.77x  SHORT of goal  (goal <= 2.3x)
  worst  zealot 2.79% (n=287)  SHORT of goal (>= 3.5%)
```

At 1,600 runs the same two lines read **1.92x, goal MET** and **scholar 3.82%,
goal MET**. Eight of fifteen archetypes draw under 500 entrants at 400 runs —
the report says so, three lines down — so the whole-field spread it prints
above that caveat is dominated by whichever small archetype got unlucky.
Zealot at n=287 needs four more victors to clear the goal.

The default invocation of the balance report therefore tells its reader that
balance is failing when it is not. Everything about the caveat is correct and
it is placed after the number. Either compute the whole-field lines only at
n ≥ `GUARD_MIN_SAMPLE` for every member, or suppress the "SHORT of goal" label
below the sample size at which it reproduces.

### 1.7 `offSeason.ts`'s header comment contradicts its own data

```
 * Deliberately and strictly cosmetic. A skin rewrites `Arena.description` and
 * nothing else: no zone, no law, no edge rule, no danger or resource value…
```

**Measured: 118 of the 120 skins carry a mechanical field.** `dangerShift` on
80, `resourceShift` on 53, `addLaw` on 34, `liftsLaw` on 28. The interface
below the comment documents all four correctly, and §6.4's comment on the
interface explains the change. The file header was never updated.

This is not a behavioural bug — the skins are seeded and replay correctly. It
is worse in a specific way: a contributor who reads the header and stops will
believe off-season skins cannot affect balance, and will not think to check a
skin when an arena's numbers move.

### 1.8 `irradiated` is the only zone effect the engine never produces

Ten `ZoneEffectKind`s are declared. Probe A sampled zone effects on every one
of 3,603 cycle-samples across 180 runs, and probe C on 160 more:

```
fogbound 1127   burning 451   stripped 407   flooded 360   contaminated 302
frozen 163   blooming 151   quaking 76   swarming 37   irradiated 0
```

`irradiated` has 45 lines of engine behind it — a 999-cycle duration, per-tick
damage, a sanity drain, and `zoneEffects.ts:224`, the only *creeping* effect in
the game, which spreads to a neighbour at 6% a cycle. Nothing starts it except
`startsZoneEffect: 'irradiated'` on **six authored events** in a handful of
arenas. It did not fire in 340 runs.

The creep is the interesting part and it is the part no player has seen.

### 1.9 `swarming` is a rounding error and `quaking` is close

Same measurement. `swarming` appeared in 37 of 3,603 cycle-samples (1.0%) and
`quaking` in 76 (2.1%), against `fogbound`'s 1,127 (31.3%). A **30x** spread
across the reachable kinds.

`swarming` is started by exactly one non-authored site (`zoneEffects.ts:589`)
and 14 authored events; `quaking` by `special: 'startsQuaking'` on 8 events.
`zoneEffects.ts:395` and `map.ts:591` are each a single read site for behaviour
that occurs in 1% of sampled cycles. Audit 3 §5.3 reported a 34x spread on this
axis and it has not moved.

### 1.10 The recurring instrument error, and the fix

Three audits running have measured live state with an end-state census and
reported a false zero. Audit 2 invented field names. Audit 3 read
`state.alliances` at the end of a run and reported five alliances across 120
runs. This one read `state.feastTheme` at the end and reported 90.6% of runs
themeless.

The pattern is the same every time and it is not carelessness — it is that
`Simulator` exposes exactly one observation point (`getState()` after a phase)
and nothing distinguishes *cumulative* state from *live* state. `runRecords.ts`
already solves this for the six things achievements needed. The general fix is
cheap: a `Simulator.observe(fn)` hook called once per phase advance, so a probe
or a check declares what it wants sampled instead of guessing which fields
survive to the epilogue. Every probe in this report re-implemented that loop by
hand.

### 1.11 Minor and cosmetic

- `components/PlaybackPopover.tsx:108` declares `role="dialog"` on a
  non-modal popover. It handles Escape and outside-click and returns focus, so
  the behaviour is right; the role is wrong (`role="group"` with the existing
  `aria-label`, or keep `aria-haspopup="dialog"` on the trigger and drop the
  role). A `dialog` that is not modal and traps nothing is a promise to a
  screen reader that the markup does not keep.
- `engine/alliance.ts:192 brandFor` offers `districtName` as
  `the District N bloc` in the pattern pool regardless of how many districts
  are actually in the group, because `districts.length === 1` is evaluated once
  for the string and never re-checked against which pattern is drawn. Multi-
  district groups can be branded `the 3-7 compact` correctly or, from the same
  pool, `the 3 and 7 alliance` — both fine — but a single-district trio and a
  five-district bloc draw from the same twenty patterns.
- `state.vengeancePacts` is emptied by every ending a pact can have, so an
  end-state read reports 0% of runs with a pact. Per-cycle it is **79.5%**, and
  `test:sim` already prints the correct `vengeancePacts: sworn=319` ledger. No
  code is wrong here; it is listed so the next audit does not re-report it.

---

## §2 — All QOL, UI and UX updates needed

The interface is in genuinely good shape. Four dialog surfaces manage focus
through one shared `useDialogFocus`; twelve `aria-live` regions cover the feed,
the chronicle, transfers and the busy state; reduced motion is honoured
globally; `test:arena-layout` holds a 46px touch target at 460px and
`test:ui-affordances` ratchets hover-only hints at 31. What follows is what is
left.

### 2.1 The largest gap: state the engine writes constantly and no screen names

A script walked `models/types.ts` for every declared field on `GameState`,
`Tribute` and `Alliance`, then searched every file under `components/`,
`screens/`, `store/` and the display utilities for the identifier.

| interface | fields | never named in any UI file |
|---|---|---|
| `GameState` | 106 | **67** |
| `Tribute` | 170 | **100** |
| `Alliance` | 23 | **16** |

Most of those are correctly internal. These are not, and each is a thing the
player would want to see:

- **`Tribute.downed`.** A tribute lying downed with a rescue window, a cause
  and a named assailant is the most dramatic state the simulation can hold.
  It occupies **1.53% of all tribute-cycles** (440 across 160 runs), resolves
  174 times to a finishing blow, 137 to a rescue and 135 to mercy — and no
  component names the field. The feed narrates it; the standings table, the
  tribute tile and the map show a normal living tribute.
- **`GameState.activeMutts`.** The mutts currently loose in the arena, with
  their zone. Named only by `saveMigrations.ts`.
- **`GameState.loveTriangles`.** Forms in **71.7% of runs** (probe A). The feed
  gets the beats; nothing shows the standing shape.
- **`Alliance.roles`, `.charter`, `.successorId`, `.factions`, `.breaches`.**
  The entire alliance-politics layer. `allianceCharter.ts:275` exports
  `charterSummary()` and **nothing imports it.** `TributeModal` shows
  `pactLabel` and stops there. A group with a three-clause charter, a named
  heir, two factions and four logged breaches renders identically to a pair
  who met yesterday.
- **`Tribute.shadowing`.** Who this tribute is following. 2.1% of
  tribute-cycles are spent in the Shadowing stance and the target is invisible.
- **`Tribute.transit`.** 7.8% of tribute-cycles are spent mid-move between
  zones. The map shows them at the origin.
- **`GameState.cornucopiaHolder`** and **`maxHornHold`**. Who is sitting on the
  horn, measured at 1.20 cycles of maximum hold per run.
- **`GameState.timeOfDay`** (`'day' | 'dusk' | 'night'`). Three values; the
  screen shows the phase, which is two.
- **`Tribute.privateSession`** and **`.trainingLog`**. The station, the stunt,
  the reaction and the score — authored, scored, read by the sponsor market,
  and never shown on the tribute sheet.

This is the fourth audit to open this heading and it is the same shape each
time: the engine is ahead of the interface by roughly one subsystem per audit.

### 2.2 Forty-seven `title=` attributes remain, nineteen of them in one component

`test:ui-affordances` correctly ratchets *controls* at 31 hover-only hints and
holds — and it holds because it counts hints on controls, which is the right
thing to ratchet. The raw count of `title=` across `components/` and `screens/`
is 47, and it is concentrated: **`TributeModal.tsx` carries 19** and
`DossierPanel.tsx` 9, with the remaining 19 spread one to three at a time
across eleven files. The tribute modal is the screen a player opens to find out
who somebody is, and two fifths of its explanatory text is in an attribute a
phone cannot display.

A native `title` never appears on touch, never opens on keyboard focus, and is
usually not announced where the element already has an accessible name. The
`Hint` component exists and is the right answer; these are the ones it has not
reached yet.

One of the 47 is the "Returning victor" chip in §1.2, whose `title` is the only
explanation of what a returning victor *is* — attached to a chip that never
renders.

### 2.3 `Hint` still cannot be read on a phone without firing the control

`components/Hint.tsx` renders the description into real DOM and reveals it on
`:hover` or `:focus-within`. On a touch screen, the only way to give a
`<button>` focus is to tap it, which also activates it. So for the 31 controls
`Hint` covers, a phone user reads the hint *as* they perform the action, or not
at all.

The component's own doc comment identifies exactly this failure in the `title`
attributes it replaced. It is better than `title` — the text is in the DOM and
a screen reader reaches it — but the touch case is not solved, only moved.

An info affordance the player can open without committing (the `Explainer`
pattern, which is click-to-open and does work on touch) is the missing rung,
for the subset of controls whose hint is load-bearing rather than a reminder.

### 2.4 Four components carry no `aria-` or `role` at all

`RunProfileCard.tsx` and `VictorArc.tsx` have zero of either and zero buttons —
both are read-only summary surfaces built from `div`s and spans. `ErrorBoundary`
and `TributeTile` have one each. `TributeTile` is the repeated card that
represents a tribute across the roster and standings; it has one `aria-`
attribute and one button.

This is the same finding as Audit 3 §2.2 with a different four components,
which suggests the gap is structural rather than a list to work through: there
is no lint rule or check asserting that a component rendering interactive or
status content declares either.

### 2.5 Sanity is 12.9% of everything the feed says

Measured over 207,463 log lines across 200 runs (probe B):

| category | share | | category | share |
|---|---|---|---|---|
| sanity | **12.91%** | | arena | 2.58% |
| system | 11.60% | | loot | 2.35% |
| training | 10.83% | | injury | 1.78% |
| travel | 10.60% | | death | 1.65% |
| interview | 9.76% | | hazard | 1.53% |
| survival | 9.29% | | gamemaker | 1.52% |
| alliance | 9.06% | | feast | 1.27% |
| combat | 7.27% | | kill | 1.04% |
| sponsor | 3.06% | | mutt | 0.90% |
| | | | betrayal | 0.60% |
| | | | romance | 0.40% |

The single most common thing the broadcast says is a sanity beat. The five
categories a viewer would call the story — death, kill, betrayal, romance,
mutt — are **4.6% combined**. `sanity`, `system`, `training` and `travel`
together are **45.9%**.

The feed's density control and category filters exist and work. What they
cannot fix is that the underlying distribution is weighted toward the three
things with the least narrative content. §3.2 explains where the sanity volume
comes from; the UX consequence is that the default reading experience is
dominated by it.

### 2.6 A run shows 96.4% distinct lines and still repeats its rarest pools

Probe B measured line-level uniqueness within a run at **96.4%** across 200
runs, which is excellent and is what the flavour floors were built to protect.
The repetition a player actually notices is elsewhere: in pools that are large
enough to pass the floor and small relative to how often the event occurs.
The arithmetic is in §10.4; the UX consequence is that the repetition is
concentrated in the *dramatic* beats, which are the lines the player reads
most attentively.

### 2.7 Smaller items

- The chronicle and the feed both render the whole run now (Audit 3 §2.5 is
  fixed). The setup screen's arena facets, "surprise me within this", presets
  and mutators are all present and good.
- `GameScreen`'s own comment describes the mobile layout problem it solved
  ("two segmented controls and a tab bar all at once") and the solution is one
  bottom tab bar. The desktop layout still carries two tab bars plus a filter
  drawer of twenty category chips.
- There is no way to see, during a run, *which* of the arena's authored
  once-per-run events have already fired, though `state.firedEvents` holds
  exactly that and the `every-door` achievement asks the player to collect them
  all. A player pursuing that achievement has no instrument.

---

## §3 — Tribute logic: updates, robustness and more complexity

### 3.1 Where the model is now

A tribute carries 170 declared fields. The decision layer measures well:
`test:decisions` over 5,657 tribute-cycles reports a trace present on 100.0%
(forced 0.7%), the held stance is the best-scoring one 55.4% of the time with
a rank histogram of 55/21/15/9, and the chosen destination is the best-scoring
one 65.5% of the time with only 2.4% falling in the bottom fifth of their own
scoring. That is a decision layer that prefers good options without being
deterministic, which is the correct shape.

Objectives, sampled per tribute-cycle over 31,840 samples (probe A):

```
survive 43.16%   reach 21.02%   hunt 18.20%   protect 6.76%
flee 6.46%       stalk 1.88%    hold 1.86%    wait 0.65%
```

All eight kinds are reachable. `wait` — 0.0% at Audit 2 — is at 0.65%.

Stances, same sampling:

```
Defensive 43.07%  Evasive 23.62%  Aggressive 21.78%  Fortified 4.29%
Hunting 2.29%     Shadowing 2.09%  Scavenging 1.48%  Desperate 1.38%
```

All eight reachable; the five conditional stances hold 11.5% of tribute-time
between them.

### 3.2 The finding: sanity is a two-state flag, and a third of tribute-time is spent at the floor

Probe C sampled `vitals.sanity` on every live tribute every cycle — 13,419
samples on the default config across all arenas — and bucketed it by ten:

| band | share | | band | share |
|---|---|---|---|---|
| 0–9 | **31.40%** | | 50–59 | 4.28% |
| 10–19 | 3.44% | | 60–69 | 4.09% |
| 20–29 | 3.34% | | 70–79 | 4.07% |
| 30–39 | 3.91% | | 80–89 | 9.49% |
| 40–49 | 4.63% | | 90–100 | **31.34%** |

p10 = 0. p25 = **0**. p50 = 57. p75 = 93.

By `sanityBandOf`'s own thresholds: **steady 44.6%, gone 33.4%, frayed 12.8%,
unravelling 9.3%.** The two bands `sanityBands.ts` was written to create — the
behavioural middle, where cover slips and parleys get harder — hold 22% of
tribute-time between them. The two ends hold 78%.

Three things follow.

**It explains §2.5.** Sanity is the largest category of feed line because a
third of the cast is permanently in the band that generates them, and the
`gone` band's residues (`goneDropChance: 0.15` per cycle, `hallucination`,
`ruinStealth`) fire every cycle against three pools of ten lines each.

**`gone` is a floor, not a transition.** Nothing in the measurement suggests
tributes pass *through* it; they arrive and stay. `sanityScarred` fires once
and `sanityRecovered` exists, but a quarter of the field sits at literal zero
for the second half of every run. A state that a third of the cast occupies
permanently is not a crisis state, it is the baseline, and the design comment
in `sanityBands.ts` describes it as the former.

**It is the only major axis with no balance guard.** `test:metrics` guards
bleeding share, weapon-carrying share, stance share, alliance-size share and
eighteen more. There is no indicator for the sanity distribution, which is why
a U-shaped distribution with p25 at zero has survived four audits.

The fix is not "make sanity drain slower" — it is that the drains and the
recoveries are not in the same order of magnitude, and the bands were placed
(70 / 40 / 15) on an assumption about the distribution rather than on the
measured one, which is exactly the mistake Audit 2 §1 found and fixed for the
suspicion axis. The same instrument, pointed one field over.

### 3.3 Tributes stay put 71.4% of cycles, and the map coverage ceiling is a consequence

Probe C, 28,811 tribute-cycles: **moved 28.58%, stayed 71.42%.**

Coverage by lifespan (fraction of the arena's zones a tribute has stood in,
probe C, 160 runs):

| days survived | n | avg zones | coverage |
|---|---|---|---|
| 1 | 1,196 | 0.06 | 0.6% |
| 3 | 211 | 2.25 | 22.3% |
| 5 | 343 | 3.05 | 30.8% |
| 7 | 188 | 3.66 | 37.0% |
| 9 | 72 | 4.08 | 37.7% |
| 12 | 37 | 5.46 | 46.6% |

Coverage over the whole cast is 18.5%; over victors, 38.1%. Audit 2 §3.1 was
withdrawn on the grounds that low coverage measured lifespan rather than
exploration. This measurement separates them, and the withdrawal was wrong in
one direction and right in another: coverage does climb with lifespan, but it
**flattens at day 7** — 37.0%, 37.7%, 38.5% on days 7, 9 and 10 — and only
moves again in the long tail where the arena is closing and movement is forced.

So the ceiling is not lifespan. A tribute who survives to day 9 has stood in
4.08 of ~10.4 zones and stopped exploring. The binding constraint is that
nothing pulls a settled tribute off ground that is working: `objectiveStep`
returns `undefined` for `hold` and `wait`, `survive` (43% of objective-cycles)
has no destination at all, and depletion — the one force that should move
somebody — sits at p50 0.18 with only 0.2% of zone-samples at the floor.

Zone occupancy makes the same point from the other side: **42.1% of
zone-samples have exactly one tribute in them**, 18.0% have two, 39.9% have
three or more. Two fifths of the arena's occupied ground is one person alone
not moving.

### 3.4 Proficiencies: three of nine barely exist, one barely grows

Probe B, terminal values across 200 runs, against a cap of 6:

| proficiency | tributes with any | mean | p50 | max |
|---|---|---|---|---|
| forage | 3,073 | 1.53 | 1.4 | 4.4 |
| melee | 2,991 | 1.80 | 1.6 | 5.6 |
| ranged | 2,141 | 1.37 | 0.9 | 4.9 |
| persuasion | 2,024 | 1.39 | 0.9 | 5.5 |
| **medicine** | 1,833 | **0.96** | **1.0** | **3.1** |
| **climbing** | 910 | 1.80 | 1.8 | 4.1 |
| **swimming** | 694 | 1.75 | 1.4 | 4.8 |
| **crafting** | 641 | 2.34 | 2.4 | 5.2 |

Two separate problems.

`medicine` is the only proficiency whose **median holder is below 1.0** and
whose ceiling across 200 runs is half the cap. It is the skill the `medic`
archetype is built on (3.93% win rate at 1,600 runs, 13th of 15) and the skill
`assignRoles` scores the `medic` role by. A skill that reaches 3.1 of 6 in the
best case across 3,800 tributes is not a progression axis.

`climbing`, `swimming` and `crafting` reach fewer than a third as many
tributes as `forage`, and each has **exactly one read site in the engine**:
`physique.ts:160`, `dayNight.ts:1317`, `survival.ts:532`. They were added to
close the doubling between the `Climber`/`Swimmer` traits and the skill system,
and they did — but a skill with one consumer is a modifier with extra steps.

### 3.5 Where the tribute could be more complex

Each of these is state the model already holds, with no consumer:

- **`objectiveOutcomes` feeds back into nothing but `sameTargetPenaltyFor`.**
  A tribute keeps `tries`, `wins` and `streak` per objective kind and the only
  use is a penalty on re-hunting the same target. A tribute whose last four
  `reach` objectives all expired unfulfilled should stop forming them, and a
  tribute whose `protect` objectives keep succeeding should form more.
- **`objectiveQueue` is live on 5.1% of tribute-cycles** and is read only as
  the next thing to pop. There is no representation of an objective a tribute
  is *saving* — the queue cannot express "after I have water".
- **`kitPriorities` is set on 60.9% of tribute-cycles** — the single most
  widely-held piece of optional tribute state in the game — and has three
  boolean fields (`warmth`, `water`, `purifier`). It is the closest thing the
  model has to a shopping list and it cannot express a weapon, a medical item,
  or a thing somebody else is carrying.
- **`weaponFamiliarity` exists per tribute per weapon** and is named by no UI
  file and, as far as the grep reaches, consumed in one place. A tribute who
  has carried the same spear for six days is not distinguishable from one who
  picked it up this morning.
- **`shock` is live on 10.0% of tribute-cycles** with an `untilCycle` and a
  `cause`, and is the only acute psychological state in the model. It has no
  gradient — a tribute is shocked or is not.

### 3.6 Robustness

No crashes, no NaN, no unguarded division found in this pass. Three fragilities:

- `phases/pregames.ts:55` matches veterans by name (§1.2).
- `engine/legendaryItems.ts:33 significant()` takes the longest word over 3
  characters after stripping parentheses, and falls back to `undefined` with
  no handling for an arena name that is entirely stop-words. The `out` array
  would then carry only the `District N's X` entry and the fixed pool would
  still not be reached (§1.3).
- `sanityBandOf` reads `t.vitals.sanity` directly rather than through a
  defensive accessor, unlike `attr()`. A save from before sanity was clamped
  would band as `gone`, which is the harshest available default.

---

## §4 — Tribute relationships and alliances: improvements and updates

### 4.1 What is working, measured

The social layer is the most heavily-built part of the simulation and most of
it is healthy. From `test:sim` at 400 runs and probe A at 180:

- **Alliances are live on 0.88 groups per cycle**, average size 3.15, largest
  seen 7. Size distribution from `test:metrics` (6,183 samples): size 2 = 2,941,
  size 3 = 1,452, size 4 = 933, size 5 = 612, size 6 = 234, size 7 = 10,
  size 8 = 1. **52.4%** of alliance samples are three or more, against a guard
  of ≥30%.
- **The truce ledger closes exactly.** 563 terms, 563 endings, 0 unaccounted,
  across renewed / lapsed / turned / broken / outlived / buried /
  dissolvedWithBroker.
- **The loan ledger closes exactly.** 284 made, 284 accounted.
- **The vengeance ledger closes exactly.** 319 sworn, 319 accounted.
- Betrayals 5.71 per run; vengeance sworn 10.78 per run; star-crossed lovers
  in 14.8% of runs (goal band 10–15%, met at 1,600 runs for the first time);
  love triangles form in **71.7% of runs**; reconciliations 926 per 400 runs.
- Suspicion drives real behaviour: 185 investigations (135 guilty, 50 cleared),
  101 pre-emptive departures, 49 nights slept apart, 92 expulsions,
  265 faction actions.
- All four `TruceReason` values occur: mutual-threat 1,090, extortion 779,
  brokered 718, both-wounded 512.
- All six pact kinds occur: until-field 28.3%, to-the-end 24.5%, no-pact 21.8%,
  until-event 10.2%, until-day 9.2%, until-goal 5.9%. Audit 3 §4.2 reported
  "half no-pact"; it is now 22%.

### 4.2 Half of all alliances name exactly one role, and it is the one with no combat effect

`assignRoles` gives a pair **one** job (`quartermaster`), a trio three, and a
group of four or more the full set of four. Probe A, over 3,187 alliance
samples:

```
quartermaster 2950   muscle 1522   scout 1522   medic 1397
```

Against `test:metrics`'s size distribution, 47.6% of alliance samples are
pairs. So for roughly half of all alliance-time the only named role is
quartermaster, and the four roles' read sites are:

| role | read sites |
|---|---|
| `quartermaster` | `alliances.ts:75` (betrayal weight), `combat.ts:1562` (cache lost on death), `alliance.ts:281` (log line) |
| `muscle` | `combat.ts:1080` (draw modifier) — **requires a second member present** |
| `medic` | `combat.ts:1081` (shield) — **requires a second member present** |
| `scout` | `memory.ts:91` (sighting propagation) |

Both combat-role effects are gated on `allyPresent`. In a pair, the ally is by
definition the other role-holder — and in a pair there is no other role-holder,
because a pair names one role. The two roles with mechanical teeth are
unreachable in the group size that is half the game.

The comment above `assignRoles` argues the case for scaling ("only a group of
four or more fields the full set, which is what makes the full set mean
something") and it is a good argument. The consequence it did not follow
through is that the *one* role a pair gets should be one that does something
in a pair, and quartermaster's three effects are all about the group's
supplies and the group's politics.

### 4.3 Bloc treaties fire and then vanish; the charter is the best-built thing here

`blocTreaties: sworn=112` per 400 runs, with all four endings occurring
(brokenByAKilling 3, lapsed 3, endedByTheField 7 — and 99 that neither the
soak nor probe A accounts for, which is the **standing-at-end** case that
`blocTreatyHeld` was added to record). Probe B found live bloc treaties on 113
cycle-samples across 200 runs, so the system runs at roughly one live treaty in
every other run.

The charter remains the best-balanced subsystem in the game. Probe A's role
sampling incidentally measured charter depth: 1 clause 1,558, 2 clauses 1,226,
3 clauses 229, 4 clauses 22, 0 clauses 152, no charter at all 190. A clean
descending distribution with a reachable tail, 123 breaches per 400 runs, and a
`charterKeptSeen` flag that closes. Nothing to fix.

`hasHeir` on 1,556 samples and `hasFactions` on 394 — succession resolves 75
times to a named heir, 9 to a passed-over heir, 20 to a split and 66 to no heir
named. Also clean.

### 4.4 The social layer's depth is invisible (restated from §2, in relationship terms)

`charterSummary()` is exported and unimported. `Alliance.roles`, `.charter`,
`.successorId`, `.factions`, `.breaches`, `.breachesBy`, `.cacheContributions`,
`.expelledIds` and `.lastWatch` are named by no component. `Tribute.trusts`,
`.respects`, `.sharedHistory`, `.formerAllies`, `.protectorBonds`,
`.brokeredTruces` and `.extortedByIds` likewise.

The derived-trust axis (`trustOf`, added in §4.3 and refined twice) is the most
carefully-reasoned function in `relationships.ts` — it holds "someone you love
and do not trust" as a representable state — and there is no surface anywhere
that shows regard and trust as two numbers. `RelationshipGraph.tsx` renders one
edge weight.

### 4.5 Where the social layer could go deeper

- **Betrayal has no memory across runs.** `continuity.ts` remembers Head
  Gamemakers and district standing between Games. A district whose tributes
  have betrayed each other three years running is the obvious third memory and
  it is not there.
- **`perceivedBonds` is stored per tribute per pair** — what A believes about
  B and C's relationship — and is the raw material for a misread. There is no
  beat where a tribute acts on a bond that is not real.
- **Truces have a reason but no terms.** All four `TruceReason`s occur and
  none of them carries a condition. "Until the feast", "until one of us is
  out of water" and "until we are both off this ridge" are all expressible with
  the pact machinery that already exists one directory over.
- **`displayedRegard` and `isPerforming` implement a lie about affection** and
  there is no counterpart lie about capability — a tribute cannot conceal a
  weapon, a wound, or how much water they have left, though `concealRevealed`
  exists for the training floor and does exactly this.
- **Extortion produces a truce** (`truceReason: 'extortion'`, 779 samples) and
  nothing else. There is no ongoing tribute, no renewal, and no record on the
  extorted tribute beyond `extortedByIds`, which no screen reads.

---

## §5 — Arena: updates, robustness and more complexity

### 5.1 What exists

40 authored arenas, 415 zones, every zone authoring its full interior (cover,
elevation, chokepoint, shelter, acoustics, verticality — 165 chokepoints, 334
shelters, 261 vertical). 12 procedural biomes. 47 mutt rosters, 196 mutts, every
id and name unique. **1,388 authored event definitions**, of which 1,323 are the
forty arena packs and 65 are the shared universal pool. 16 arena laws, stackable. 10 zone effect kinds. 8 feast themes. 7 edge
rule kinds. 120 off-season skins.

`test:arenas` plays stacked-law combinations to completion in eleven arenas and
all eleven terminate. `test:arena-layout` lays out 160 arenas with no label
collisions and a minimum separation of 74px at the 16-zone ceiling.
`test:zone-features` holds 415/415.

### 5.2 Every authored pack is exactly 33 events, and the shape is identical

Forty of the forty authored arenas carry 33 or 34 events. All forty carry 3–5
once-per-run events and **exactly one** chain. The soft target is 40 and every
pack is under it; `test:flavor` puts the gap at 277 events across the roster.

The uniformity matters more than the shortfall. An arena's pack size, its
once-per-run count and its chain count are the same everywhere, so no arena is
*denser* than another in authored incident — which is the main lever for making
one arena feel more authored than the next. The per-run reach spread (§1.5:
frozen 3.7, labyrinth 8.0 of 33) is produced by terrain distribution and zone
count, not by anything an author chose.

### 5.3 The `requires` vocabulary is built and barely used

`ArenaEventDef.requires` supports eleven predicates. Across all 1,388 events:

| predicate | events using it |
|---|---|
| `time` | 77 |
| `law` | 25 |
| `storm` | 24 |
| `trait` | 19 |
| `elevationOrChoke` | 18 |
| `effect` | 17 |
| `maxSurvivors` | 14 |
| `stance` | 13 |
| `minSurvivors` | 10 |
| `sanityBand` | 8 |
| `loadBearing` | **4** |

229 uses across 1,388 events — **84% of authored events have no precondition at
all** beyond terrain. The three predicates that would make an event feel like it
belongs to a *moment* rather than a place — `minSurvivors`, `sanityBand`,
`loadBearing` — are on 22 events between them, 1.6% of the roster.

Similarly: only **61 events (4.4%) declare a `weight`**, so within a pack every
event is equally likely; `special` has two members (`collapse` 24,
`startsQuaking` 8); and `dodgeStat` is `intelligence` or `agility` on 56% of
events, `charisma` on **four**.

### 5.4 Fourteen of sixteen laws take something away, and the two that give are the rarest

`Arena.law` became `Arena.laws` in §5.1 so an arena can stack rules, and it
does: over 600 arena draws across all 41 arena ids, **417 runs carry one law,
159 carry two, 16 carry three and 8 carry none.** Every one of the sixteen laws
is reachable. Share of runs carrying each:

```
fireImpossible 14.8%   noWaterExceptZone 14.8%   noSponsors 12.3%
noForage 9.7%          noHealing 9.7%            noCannons 9.5%
cornucopiaRefills 7.8% oneWayBorders 7.7%        openMic 7.5%
noNight 7.3%           deadlyNight 7.2%          sponsorsFixedZone 7.2%
noWeapons 5.2%         shrinkingArena 5.0%
dawnMercy 2.5%         bountifulGround 2.3%      (no law at all) 1.3%
```

`bountifulGround` and `dawnMercy` are the two laws the last fix pass added
specifically because eleven of fifteen laws were subtractions. They are the
**two rarest of the sixteen**, at 4.8% of runs combined, because they are
pinned to one arena each (Story Wood, Carnival) rather than drawable. So the
count is now 14 subtractive to 2 additive, and weighted by exposure the ratio
the last audit found is substantially unchanged: a player meets a law that
gives something in one run in twenty.

`cornucopiaRefills` and `bountifulGround` are the only two that add resources;
`dawnMercy` is the only one that reduces danger. Everything else removes water,
fire, healing, forage, sponsors, weapons, cannons, night, or ground.

### 5.5 Zone effects have a 30x spread and one dead member

Restated from §1.8 and §1.9 in arena terms. Ten kinds; `irradiated` never
occurs in 340 runs; `swarming` is 1.0% and `quaking` 2.1% of sampled effects
against `fogbound`'s 31.3%.

Five arenas author **zero** events that start a zone effect — `reef`, `floe`,
`alpine`, `nooneplace`, `craterfield` — and seven more author exactly one
(`frozen`, `canopy`, `carnival`, `quarry`, `acousticforest`, `redcathedral`,
`storywood`). The distribution across the roster runs 0 to 9.

Across all 1,388 events, `startsZoneEffect` appears 116 times and breaks down
`contaminated` 25, `burning` 23, `flooded` 17, `blooming` 16, `swarming` 14,
`fogbound` 11, `irradiated` 6, `frozen` **3**, `stripped` **1**.

### 5.6 The edge-rule layer, in arena terms

Fully stated in §1.1. From the arena's side: 34 of 40 arenas carry any edge
rule and 26 of those carry exactly one, so the "this map has a geography, not
just a graph" layer is a single tolled crossing in most arenas. The procedural
generator composes three of seven kinds and never composes the four interesting
ones.

`redcathedral` (5 rules), `culdesac`, `labyrinth` and `kelvin` (3 each) are the
arenas where this layer is actually doing work, and they are the ones with the
highest per-run event reach.

### 5.7 Where the arena could be more complex

- **Zone effects cannot interact.** `burning` next to `flooded` is two
  independent entries in a `Record<string, ZoneEffect[]>`. Fire meeting water,
  fog over a flood, a freeze over a flood — all expressible in the existing
  structure and none implemented. `nextSpreadCycle` and `chainLength` exist for
  fire alone.
- **`severity` is declared on `ZoneEffect` and defaults to 1** with no site
  found that sets it above or below.
- **`structuralFatigue` and `climateDrift` are per-zone and per-run state** and
  probe A found `climateDrift` present in **85.6% of runs** — so the arena is
  drifting toward heat, cold, wet or dry in five runs out of six, and the four
  directions are indistinguishable in outcome because nothing keys off
  `toward`.
- **Collapsed zones average 3.25 per run and severed edges 1.09**, but
  `tickOpeningEdges` re-opens severed edges at `EDGE_RULES.reopenChance` and is
  disabled the moment `escalationDay` is set. The arena can only get smaller
  during the half of the run when it matters.
- **A zone's `resources` deplete to p50 0.18 and only 0.2% reach the floor.**
  Nobody is ever actually starved off ground by having eaten it out; §3.3 shows
  what that costs in movement.

---

## §6 — Small and side features: updates, robustness and complexity

### 6.1 Wildcards: 27 kinds, all reachable, all consumed

Correcting Audit 3 §6.1 (which was itself a withdrawal of an earlier error):
there are **27** `WildcardDef` entries. Nineteen have a `case` in
`resolveWildcard`; the other eight are `day: 0` standing conditions folded into
the run's config by `configForProfile`. Every one of the eight was traced to a
consumer:

`no-feast` → `enableFeast = false`; `sponsor-flood` → `sponsorGenerosity *= 1.7`;
`rule-change-allies` → `betrayalRate *= 0.5` **and** `victory.ts:63`;
`rule-change-no-allies` → `betrayalRate *= 2.5` **and** `alliances.ts:443`;
`quarter-quell-pairs` → `betrayalRate *= 0.6` **and** `victory.ts:73` **and** a
cast-shape override; `quarter-quell-doubled` → `hazardRate *= 1.6` **and** a
cast-shape override; `silent-arena` → `gamesProfile.ts:319`; `nothing` →
guarded in the dossier.

No dead wildcards. Five further `EXTRA_DISRUPTIONS` fire off-calendar at
decaying odds, capped at `WILDCARD.maxExtraDisruptions`.

### 6.2 Quells: 27 authored, 6% of runs, so most are effectively unseen

Probe A, 180 runs: **93.9% of runs have no Quell.** The eleven that appeared did
so once or twice each (`no-alliances` 3, `the-youngest` 2, and seven others at
1). `drawQuell` weights `NO_QUELL_WEIGHT` against the sum of all Quell weights
by design — "most Games are not Quarter Quells" — and the design is right.

The consequence is arithmetic: 27 Quells sharing 6.1% of runs is **0.23% per
Quell**. A player would run four hundred Games and still not see several of
them. The Setup screen's "Force a Quell" toggle is the mitigation and it is the
only one; there is no way to force a *specific* Quell, and no record of which
Quells a player has seen beyond `PanemRecords.quellsSeen`, which is displayed
in the record book and drives nothing.

27 authored set-pieces at 0.23% each is the single largest ratio of
authored-content to player-exposure in the repository.

### 6.3 Quirks are 340 lines of flavour with no mechanics

85 quirks, each `{ label, lines }` with at least 4 line variants. `QUIRKS` is
read in exactly two places: `generator.ts:536` assigns one (plus a second at
`GENERATION.secondQuirkChance`), and `encounters.ts:821` surfaces a line at
`ZONES.quirkLineChance` on a quiet cycle. One achievement counts holding two.

Nothing a quirk says has ever changed anything. "Stacks their supplies in the
same order", "won't say the word arena", "sleeps sitting up" — each of those is
a mechanical hook written in prose and left as prose. The 85 labels are the
best character-differentiation content in the game and they are inert.

This is the clearest "shallow feature" in the repository and it is also the
cheapest to deepen, because the labels already describe what the mechanic would
be.

### 6.4 The gamemaker lever set is good and opt-in only

Twelve `GamemakerEventType`s (`mutt`, `weather`, `feast`, `burn`, `flood`, `fog`,
`sever`, `bounty`, `drop`, `mercy`, `reveal`, `strip`), each with a per-run
escalating cost and a cooldown, surfaced in `DossierPanel` with `Hint`s.
`gamemakerMode` is a Setup checkbox, default off, and there is no in-run way to
turn it on — so a player who does not tick it never sees the twelve levers or
the `gamemakerUse` ledger built for them.

### 6.5 The other side features, briefly

- **Debts and loans.** 284 loans per 400 runs, ledger closes exactly, 107 debts
  repaid. `Tribute.debts` is held by 9.4% of tributes at the end. Healthy.
- **Notoriety.** Peak 94, 3,795 ledger entries without contact, 163 strangers
  known by name. The system works; nothing displays it.
- **Epithets.** 8.5% of tributes earn one; 122 distinct across 180 runs from a
  set of composed patterns. The top ten are generic ("the Arithmetic", "the
  One They Stopped Naming") and the long tail is arena- and district-specific
  ("the Butcher of Cistern Hollows", "District 10's Last Word"), which is the
  right shape.
- **Veterans / Grudge Match.** Functional, gated on a non-empty Hall of Fame,
  and its one in-modal badge is broken (§1.2).
- **Off-season skins.** 120 across 40 arenas, three each, 18% chance per run.
  118 of 120 carry a mechanical field despite the header comment (§1.7).
- **Side markets, player sponsorship, patronage, coins.** All wired, all
  surfaced on the Setup screen, `COIN_ECONOMY` fully declared.
- **Continuity.** Head Gamemakers remember being beaten; districts remember
  their standing. Derived rather than stored, which is the right call.

### 6.6 Traps: all five kinds reachable, two of them barely

611 traps set per 400 runs, 183 triggered. By kind, from the soak:

```
deadfall 226   pit 210   snare 105   tripwire 65   stake 5
```

Probe A's per-cycle sampling of live traps agrees in shape (pit 185,
deadfall 184, snare 55, tripwire 39, **stake 10**). The last fix pass took
`stake` from 0 to 7 and it is now 0.8% of traps set. It is reachable, which was
the finding; it is not yet a thing that happens.

---

## §7 — More ways to die, and more events

### 7.1 Where deaths come from now

`test:metrics` at 1,600 runs, 28,861 deaths:

```
tribute 55.4%   arena/hazard 10.6%   dehydration 6.2%   bleeding 6.1%
poison 4.9%     frostbite 4.3%       burns 3.8%         infection 3.5%
mutts 3.2%      starvation 1.1%      border 0.8%
```

The *variety* underneath those buckets is much better than the buckets suggest.
Probe A's raw cause-of-death census over 3,420 tributes found **347 distinct
cause strings**, including named-mutt deaths, per-zone collapses, per-zone
border deaths, per-zone fires, falls from a named height, drownings on a named
crossing, sepsis by wound site, and 40+ distinct `Bled out from a wound <name>
opened` credits. This is the deepest death table of the four audits and the
thirteen universal hazards from the last fix pass are all present in it.

### 7.2 Universal ways to die the model has state for and does not use

Each of these reads only fields that already exist and are already written.

- **Exhaustion from sleep debt.** `sleepDebt` is tracked and `deprivedDrops`
  fires 127 times per 400 runs. "Collapsed from exhaustion" exists as a cause
  (47 in probe A) but is driven by fatigue, not by accumulated sleep debt.
  Dying on the fourth consecutive night without sleep is a different death.
- **Dying of a scar.** `scars` is written for grade-2 injuries and read by an
  achievement. An old wound reopening under load is a death the body model
  already describes.
- **Being crushed by a load.** `carryCapacity` binds 695 times per 400 runs and
  the only consequence is dropping something. Overloaded plus a fall
  (`elevationOrChoke` is on 18 events) is a death with no new state.
- **Dying of thirst while standing in water you cannot drink.**
  `noWaterExceptZone` is the second-most-common law (14.4% of runs) and
  `purifies` is an item property. The specific irony has no death.
- **Dying of the cure.** `morphling`, `antidote` and `nightlock` are all in the
  item table; `poisonedByWeapon` is tracked. An overdose is one line.
- **Being killed by your own trap.** Probe A found `Caught in their own snare`
  (2) and `Caught in their own pit` (2) — so this exists and is 4 deaths in
  3,420. `trapsSet` is 611 per 400 runs and `trapsDisarmed` is tracked. A trap
  a tribute forgot the location of, after `memory` decay, is the version that
  should happen more.
- **Dying in a zone effect nobody started.** `walkedIntoEffect` and
  `zoneEffectsCaused` are both tracked per tribute and neither has a death.
- **Bleeding out during a rescue.** Probe A found 4 (`Bled out during a rescue
  attempt`) against 137 successful rescues. The downed state (§2.1) is 1.53% of
  tribute-cycles and has one failure death.

### 7.3 Arena-specific deaths, and why there should be more

Every arena authors two signature deaths and they land: probe A's census has
per-arena entries for machinery (`The Piston Hall`, `The Conveyor Deck`), tides
(`The Sea Cave`, `Breakwater`), calving ice (`The Blue Galleries`), benches
going down (`The Spiral Road`, `The Middle Benches`), seed-shrapnel (`The
Standing Dead`), scrubber failure, pressure pods, and a `Quell` execution.

What is missing is that **471 of 1,388 authored events carry damage ≥ 30** and
only a fraction of those are arena-*specific* in their cause string; the
majority resolve into the shared `arena/hazard` bucket. The instrument for
telling them apart exists (`deathCausesInRun` in `encounters.ts:341` unions
every distinct death template a run produced, and is designed for exactly a
completion figure) and **nothing calls it.**

Arena-specific deaths worth adding, one per under-served arena, all using
existing state:

- Arenas with `verticality` (261 zones) and no fall death of their own —
  `levelsStood` and `verticalZonesStood` are tracked per tribute.
- Arenas with `acoustics` — `zoneAcoustics` exists and `openMic` is a law at
  7.8% of runs. A death caused by being *heard* has no entry anywhere.
- The six arenas with no zone-effect-starting event (§5.5). Each one should
  have a way its own ground turns.
- `loadBearing` is on four events across the roster and `map.ts` computes it
  for every `ruins` zone. Every ruins arena can afford a collapse keyed to it.

### 7.4 More events, universal

The universal pool is 65 events, of which 17 are boons — **26%**, against 19.5%
across the whole roster. It takes a fixed share of every arena's draw, which is
what makes it the highest-leverage pool in the game and also what makes it the
most dangerous to extend: the last fix pass added thirteen hazards, moved the
universal pool from 18.8% to 14.8% boons, and cost the medic archetype 1.3
percentage points of win rate before it was caught and corrected. That episode
is recorded in the CHANGELOG and is the right precedent.

Extensions that do not move ambient lethality:

- **Events keyed to `minSurvivors`** (10 events today). The universal pool has
  no late-game register at all — the same fifteen things can happen on day 1
  with 24 alive and on day 11 with 3.
- **Events keyed to `sanityBand`** (8 events). Given §3.2, a third of the cast
  is permanently in `gone` and there are eight events in the game that know it.
- **Events keyed to `stance`** (13 events). Five conditional stances hold 11.5%
  of tribute-time and almost nothing in the world reacts to being in one.
- **Boons with a cost.** 270 of 1,388 events are boon-only and 1,109 are
  harmful; there are **9 neutral** events in the entire roster. The shape the
  table cannot currently express is "this helps and it will be noticed" —
  which is the whole texture of a sponsor gift and has no ambient equivalent.

### 7.5 More events, arena-specific

The per-arena packs are uniform at 33 (§5.2) and the soft target is 40, so
there is a declared 277-event gap. Where those should go, in priority order:

1. **The 23 arenas that do not author conditional-stance actions.**
   `test:flavor` reports `fortify`, `scavenge`, `shadow` and `flail` each
   authored by **17 of 40** arenas; the other 23 fall back to a 12-line generic
   pool. A tribute fortifying in the Red Cathedral and a tribute fortifying in
   the Salt Flats currently do the same thing in the same words.
2. **Chains.** Every arena has exactly one. A chain is the only device in the
   event system that produces a *sequence*, and the roster has 40 of them
   across 1,388 events (41 counting the universal pack's).
3. **`witnesses: true`** is on 157 events (11.3%). An event nobody sees is
   weather; an event three people see is a story. The field is free.
4. **Reactive events** keyed to `requires.effect` (17 today) — the arena
   responding to its own state is the cheapest way to make a zone feel like it
   remembers what happened in it.

---

## §8 — Trait and archetype balance audit

### 8.1 The headline: this is now in good shape, and the default report hides it

At **1,600 runs**, 22 of 23 indicators meet their design goal, not merely their
regression guard. The whole-field archetype spread is **1.92x** (goal ≤2.3x)
and the worst archetype is **3.82%** (goal ≥3.5%). Both were failing at the
last audit. The one indicator still short of goal is **victors with zero kills
at 29.9%** against a goal of ≤25%, and it has moved 43.4% → 32.2% → 29.9%
across three fix passes.

At the default 400 runs the same report prints two SHORT-of-goal lines that do
not reproduce. That is §1.6 and it matters here because it is the line a
balance change will be judged against.

### 8.2 Archetypes, all fifteen, at n ≥ 813

| archetype | n | win% | avg days | avg kills |
|---|---|---|---|---|
| career | 3,582 | 7.34% | 4.20 | 0.96 |
| survivalist | 2,979 | 7.25% | 4.08 | 0.44 |
| ghost | 1,325 | 5.96% | 4.26 | 0.40 |
| beast | 813 | 5.17% | 3.07 | 0.79 |
| wildcard | 2,433 | 4.93% | 3.19 | 0.68 |
| trickster | 2,848 | 4.88% | 3.38 | 0.59 |
| protector | 3,334 | 4.71% | 3.78 | 0.50 |
| diplomat | 1,010 | 4.65% | 3.91 | 0.42 |
| mercenary | 1,365 | 4.47% | 3.33 | 0.60 |
| strategist | 2,798 | 4.40% | 3.74 | 0.48 |
| underdog | 3,413 | 4.16% | 3.78 | 0.38 |
| saboteur | 1,108 | 4.06% | 3.62 | 0.39 |
| medic | 1,069 | 3.93% | 4.06 | 0.40 |
| zealot | 1,152 | 3.91% | 2.92 | 0.62 |
| scholar | 1,231 | 3.82% | 3.67 | 0.31 |

Zealot was the last audit's worst at 2.16% and is now 3.91%; medic 3.64% →
3.93%; ghost 2.78% → 5.96% across two passes. The fixes worked.

**Scholar is the new floor at 3.82%**, with the lowest kill count in the game
(0.31) and a below-median survival (3.67 days). It has the third-highest
signature fire rate (60.8%) — so its set piece is landing and converting into
nothing. Scholar is `late-blooming` with `targetPreference: 'weakest'`, a
4-point stat budget and two preferred traits; it looks on paper like a
strategist with better patience and measures worse than one.

### 8.3 The archetype table's unused columns

A census of all fifteen `ArchetypeDef` rows:

| field | archetypes carrying it |
|---|---|
| `targetPreference` | 15/15 |
| `riskCurve` | 15/15 |
| `signature` | 15/15 |
| `stanceBias` | 15/15 |
| `objectiveBias` | 15/15 |
| `hatesArchetypes` | 9/15 |
| `fearScale` | 4/15 |
| **`targetDraw`** | **1/15** |

`targetDraw` is the only dial in the table that expresses "the field wants this
archetype dead", and it was added specifically as Career's trade-off. It is the
most interesting column in the file and it has one entry.

`riskCurve` has four values and **seven of fifteen archetypes take
`escalating`** — nearly half the roster shares one curve. `targetPreference`
has five values and six archetypes take `weakest`.

`statBias` magnitude (sum of absolute values) ranges from **1 (wildcard)** to
**7 (beast)**. Beast carries more than double any other archetype's attribute
budget and returns a mid-table 5.17%; wildcard carries the smallest and returns
4.93%. The budget is not currently buying anything measurable.

`preferredTraits` is **2 or 3 entries** for every archetype, drawn from a pool
of 53 reaping traits. Fifteen characters differentiated by two trait
preferences each.

### 8.4 Reaping traits: 2.34x spread, and the sign is right almost everywhere

At 1,600 runs, 53 reaping traits, n ≥ 693 each. Best Hydrophilic 7.65%, worst
Fire-Shy 3.26% — a **2.34x** spread against a goal of ≤2.5x, met for the first
time. The report's own caveat is correct and important: archetype
`preferredTraits` skew every large sample, so a trait far off the mean with a
big n may be measuring who receives it.

Two traits at the bottom deserve separate treatment:

- **`Fire-Shy` (3.26%)** is a declared liability (`burnResist: -0.4`,
  `campSkill: -0.15`, no upside). Being worst is correct.
- **`Diplomatic Cover` (3.26%)** is not declared a liability, and it is tied for
  worst. It is the only trait in the bottom five without a stated downside.
  Worth one look.

`Loyal` (3.78%) and `Vengeful` (3.81%) are the next two up and both are traits
whose mods bind the holder's behaviour rather than improving it — which is a
coherent design, but three of the four worst traits being "traits that commit
you to something" is a pattern rather than a coincidence.

### 8.5 Trait power levels, by modifier magnitude

From `test:metrics`:

```
combat    n=25  mean 0.89  sd 0.92   hot: Hardened 3.45 (2.8sd), Unremarkable 2.92 (2.2sd)
social    n=14  mean 0.96  sd 0.33   hot: Peacemaker 1.65, Sworn 1.50
                                     cold: Treacherous 0.45 (-1.5sd), Oathbound 0.35 (-1.8sd)
survival  n=27  mean 0.87  sd 0.62   hot: Waterborn 2.54 (2.7sd), Broken 2.00
```

The social category has an sd of 0.33 against combat's 0.92 — social traits are
far more tightly clustered, which is a design choice worth being deliberate
about rather than incidental. Fourteen social traits within ±0.33 of each other
cannot differentiate a cast the way twenty-five combat traits at ±0.92 can.

Every one of the 51 declared `TraitMod` keys is carried by at least one trait,
and every trait carries at least one mod. That is clean and was not true two
audits ago. But the distribution is steep: `allianceAffinity` is on 22 traits,
`retreat` on 16, `resolveDrift` on 13 — and **nine keys are carried by
exactly one trait each** (`thirstDrain`, `awarenessNight`, `coldResist`,
`highland`, `wrestle`, `burnOnHit`, `vengeanceEdge`, `sponsorAppeal`,
`muttDamage`). A hook with one supplier is a bespoke branch
wearing a data table's clothes.

### 8.6 Fifty-six hard-coded `traits.includes('X')` sites remain

`data/traits.ts`'s header comment states the file's purpose:

> A grep found the real cost: Pyromaniac had one reference, Charismatic one…
> The fix is not "add more if-statements". It is to make a trait a row of
> modifiers against a fixed set of named hooks.

A grep of `src/` outside that file finds **56** surviving
`traits.includes('Name')` sites:

```
Star-Crossed 12   Pacifist 6   Softhearted 5   Ruthless 4   Bloodthirsty 4
Merciful 3        Brute 3      Skittish 2      Unremarkable 2  Showman 2
Grim 2            Strategist 2  …and 7 more at 1
```

Star-Crossed at twelve sites is a mechanic, not a trait, and should probably be
modelled as one. The other 44 are the pattern the file was written to remove,
persisting one audit at a time.

### 8.7 Earned traits: one is still below the field

Earned traits measure survivorship, not power, and are read against the field's
~5% baseline rather than against each other:

```
Vulture 40.18%   Ruthless 34.91%   Silent Step 27.47%   Merciful 23.05%
Feared 22.93%    Hollow 22.72%     Waterborn 22.08%     Firetouched 16.41%
Broken 13.55%    Starved 12.94%    Bloodied 11.86%      Star-Crossed 10.91%
Trapwise 10.48%  Oathbound 10.30%  Haunted 8.46%        Venom-Wise 7.55%
Marked 7.49%     Hardened 2.68%
```

Seventeen of eighteen are above the field. **`Hardened` at 2.68% (n=336) is the
only one below it, and is below by half.** The trait's own comment documents
this honestly — it is earned by surviving mutts twice, so every holder has
already been mauled twice — and the last pass raised its mitigation
(`muttDamage: -0.6`, `combatPower: 1.5`, `retreat: 0.15`), moving it from 0.65%
to 2.68%. It is a real improvement and it has not closed. Hardened also carries
the **largest modifier magnitude of any combat trait** (3.45, +2.8 sd), so the
file now has its single most heavily-modified trait sitting at half the field
win rate. Whatever is wrong is upstream of the mods.

---

## §9 — Replayability, and keeping the game from going stale

### 9.1 What already fights staleness, measured

- **40 authored arenas + 12 procedural biomes**, and a procedural arena can
  roll to 16 zones with its own terrain variants, mutt roster and signature
  rule.
- **9 temperaments**, drawn near-evenly (probe B, 200 runs: treacherous 13.0%,
  blitz 13.0%, standard 12.5%, merciful 12.5%, compressed 12.0%, attrition
  12.0%, lean 9.5%, lavish 9.5%, hostile 6.0%). This is the best-distributed
  variety axis in the game.
- **16 arena laws**, stackable, played to completion in eleven stacked
  combinations by `test:arenas`.
- **27 wildcards** on a per-run calendar plus up to N off-calendar disruptions.
- **8 cast shapes**, **27 Quells**, **120 off-season skins**, **6 mutators**,
  **4 presets**, a **shared daily seed**, a **featured arena**, and arena
  facets with "surprise me within this".
- **A run is 96.4% distinct lines** and the arena laws, the temperament, the
  cast shape and the arena itself are all rolled independently.

By any reasonable measure the variety infrastructure is finished. The problems
below are about *distribution* and *exposure*, not about whether the content
exists.

### 9.2 The structural problem: variety is front-loaded and the tail is unreachable

Three of the game's biggest content investments have exposure rates that make
them effectively single-view content:

| content | count | exposure per item |
|---|---|---|
| Quells | 27 | **0.23% of runs** |
| Off-season skins | 120 | ~0.15% of runs each |
| Additive arena laws | 2 | 2.3% and 2.5% of runs |

Against that, temperaments (9 items, 6.0–13.0% each) and arena laws overall
(16 items, 2.3–14.8% each) are well distributed — laws in particular are a
model of how this should look, with every member reachable and the spread
inside one order of magnitude.

The Quell number is the one worth acting on. Twenty-seven authored set-pieces,
each with a name, an announcement, a cast-shape or config override and in
several cases its own mechanics in `QUELL_MECHANICS`, sharing 6.1% of runs. The
"Force a Quell" toggle exists but rolls randomly from the same weights, so a
player who wants to see The Reflection has no way to ask for it.

### 9.3 What run N does to run N+1, and what it does not

`continuity.ts` is genuinely good and its reasoning (derive, do not store) is
right. It carries two memories: a Head Gamemaker who remembers being beaten,
and a district that remembers its standing.

What does not carry:

- **Which Quells, arenas, mutts, death templates or events a player has seen.**
  `PanemRecords.quellsSeen` exists; `deathCausesInRun` exists and is uncalled;
  `state.muttsSeen` is written every run and named by no UI file. The
  infrastructure for a completion axis — the thing that turns 27 Quells and 347
  death templates from a lottery into a collection — is 90% built and 0%
  surfaced.
- **The daily seed has no result.** `dailySeed()` produces the same cast in the
  same arena for everybody on a given UTC day, which is the entire hard part of
  a daily. There is no stored daily result, no comparison, and no record that
  the player ran it.
- **Betrayal, alliance and rivalry history** (§4.5).

### 9.4 Two things that will feel stale before they measure stale

- **Sanity.** A third of every run's tribute-time spent in one band, generating
  the most common category of feed line from three pools of ten (§3.2, §2.5).
  This is the highest felt-repetition-per-line in the repository and it is not
  a flavour-pool problem — the pools clear their floor. It is that the state
  they serve is occupied far more than its authors assumed.
- **The uniform arena pack.** Every arena has 33 events, 3–5 once-per-run, one
  chain, and shows 3.7–8.0 of them per run. A player's second run in an arena
  is 80% new; their tenth is not, and there is nothing in the pack shape that
  varies to compensate — no arena gets *denser* the more you play it, and the
  off-season skin (18% chance) is the only thing that reads differently.

### 9.5 The axes worth opening

- **A "seen it" ledger.** Everything needed is already written per run:
  `muttsSeen`, `quellsSeen`, `deathCausesInRun()`, `eventLastFired`,
  `firedEvents`, `forceFieldSeen`. Union them into `PanemRecords` and the game
  acquires a completion dimension across 27 Quells, 196 mutts, 347 death
  templates and 1,449 events without one new mechanic.
- **Let a player pin a Quell, a temperament or a cast shape.** The Setup screen
  already pins an arena, a law facet and a seed. Three more selects would take
  the 0.23%-per-Quell problem off the table entirely.
- **A daily result.** The hard half is done.
- **Density as an arena property.** Let some arenas author 50 events and some
  author 24, and let `weight` (on 4.4% of events today) actually mean
  something, so that arenas differ in how much authored incident they carry.

---

## §10 — Shallow and incomplete mechanics; names and flavour

### 10.1 Mechanics that are shallower than their code suggests

- **Quirks.** 85 labels, 340+ lines, zero mechanics (§6.3). The single largest
  gap between what a feature looks like and what it does.
- **Garrisons and contested edges.** ~60 lines of engine on one authored edge;
  0 occurrences in 160 runs (§1.1).
- **Edge crossings.** The "a bridge spends itself" mechanic, on 5 edges across
  40 arenas; 0.0 per run (§1.1).
- **Hidden edges.** `Tribute.knownEdges`, `tickHiddenEdges` and
  `tellAllyAboutEdge` — a discovery mechanic, a per-tribute map memory and an
  ally-briefing beat — standing on **two** authored edges across forty arenas.
  The wider intel economy is alive (2.70 trades per run) because `parley.ts`
  and `memory.ts` feed it from rumours and tolls; it is the *map* half that
  has nothing to trade.
- **`climateDrift`.** Present in **85.6% of runs**, with four directions
  (`heat`/`cold`/`wet`/`dry`) and a `progress` scalar, and nothing keys off
  `toward`. The most widely-occurring piece of arena state in the game is
  currently a number with a label.
- **`ZoneEffect.severity`.** Declared, defaults to 1, never set otherwise.
- **`shock`.** Live on 10.0% of tribute-cycles, binary.
- **`weaponFamiliarity`.** Per tribute per weapon, effectively unread.
- **Off-season skins**, whose header still describes the cosmetic-only version
  the file no longer implements (§1.7).
- **`objectiveOutcomes`.** Full per-kind win/loss ledger feeding one penalty
  (§3.5).

### 10.2 Mutts: 196 authored, 166 seen, 37 still role-less

Probe A saw **166 of 196 mutts** across 180 runs, with a long tail at 1
sighting each. `test:arenas` confirms 196 across 47 rosters with unique ids and
names. Roles:

```
herder 39   ambusher 33   swarm 30   parasite 20   mimic 14
scavenger 12   siege 11   (none) 37
```

Thirty-seven remain deliberately plain, which the last fix pass documented as
intentional (roles that narrow eligibility were only assigned where they add no
new restriction). That reasoning holds. Two notes:

- `siege` at 11 is the thinnest role, and it is the only one with a positional
  rule (`homeZone` — "the zone it never leaves"). Eleven mutts across 47
  rosters carry the only mutt behaviour tied to geography.
- Mutt encounters run at **2,292 per 400 runs** and produce **3.2% of deaths**.
  The encounter is frequent and the lethality is low, which is the correct
  shape for an ambient threat and worth stating so it is not "fixed".

### 10.3 Names

3,200 given names across 16 districts, 204 mentors (12 per district, none
shared), 191 names appearing in exactly two pools and none in more than two,
and no themed name has wandered out of its district. `test:names` holds all of
it. This is the most thoroughly guarded content in the repository.

**A correction to Audit 3 §10.3.** That report recommended adding surnames as
"the largest identity multiplier available", and the CHANGELOG records it as
left open. Surnames are not missing — they were **removed**, deliberately, in
`12904f5`, and `names.ts:489` documents why:

> Nothing downstream wanted the second half: the feed, the kill log, the
> chronicle and the alliance brands all split it back off again, and the one
> mechanic that read it — two slips out of the same family — recognised kin by
> string-comparing the suffix.

The kin roll survives on its own (`generator.ts:305`, 15% per district). The
last audit re-litigated a decision it had not read the reasoning for, and this
report is not going to repeat that. If district families are wanted, they want
a `family` field, not a name suffix — the string-comparison approach is exactly
what was removed.

What names could still use:

- **Mentor names are 204 across 16 districts and mentors are the recurring
  cast** — the same twelve people per district every run. That is correct and
  intentional. There is no mentor *identity* beyond the name and the legacy
  tier: no history, no record of how their previous tributes did, no
  relationship with the player's patron district, though `continuity.ts` tracks
  exactly that shape for Head Gamemakers.
- **Tokens: 96 distinct**, well distributed (5 to 39 occurrences across 3,420
  tributes), and among the best writing in the repository. Purely flavour.
- **Epithets: 122 distinct across 180 runs**, composed from patterns. The
  arena- and district-specific tail is good; the ten generic ones at the top
  account for roughly a third of all epithets earned.

### 10.4 Flavour: where more *types* are needed

Every pool clears its floor and `test:flavor` is clean. The gaps are ratios,
not floors. The arithmetic below is lines-in-pool against measured
occurrences-per-run:

| pool | lines | occurrences per run (400-run soak) | runs before repeat |
|---|---|---|---|
| `SANITY_TEXTS.*` | 10 each | sanity is 12.9% of ~760 lines/run ≈ **98/run** | **within one run** |
| `ROMANCE_TEXTS` | 18 | lovers in 14.8% of runs | ~7 lover-runs |
| `ROMANCE_BOND_TEXTS` | 19 | triangles in 71.7% of runs, 315 jealousy beats/400 runs | ~1 run |
| `SPONSOR_TEXTS` | 19 | sponsor is 3.1% of lines ≈ 23/run | **within one run** |
| `INTIMIDATION_TEXTS` | 18 | standoffs 75/400, tributes paid 56/400 | ~50 runs |
| `PROTECTOR_BOND_TEXTS` | 18 | protect objectives 6.8% of tribute-cycles | **within one run** |
| `GRIEF_TEXTS` | 55 | ~18 deaths/run | ~3 runs |
| `BETRAYAL_WITNESS_TEXTS` | 30 | 5.71 betrayals/run | ~5 runs |
| `RELIEF_TEXTS` | 18 | — | — |
| `DYNAMIC_AMBIENT_TEXTS` | 12 | — | — |

The last fix pass raised grief 15 → 55 on exactly this reasoning and it worked.
The same arithmetic now points at **sanity (three pools of 10 against ~98
sanity lines a run), sponsor (19 against 23 a run) and protector bonds (18
against a state held in 6.8% of tribute-cycles)**.

147 nested flavour pools sit at the floor of 8, including all sixteen
`ARCHETYPE_SIGNATURE_TEXTS` entries, all ten `MENTOR_TIER_*` entries, and every
`TRAINING_*` pool. The floor is doing real work; it is also now the most common
pool size in the file, which means the floor has become the target.

Where more *types* of flavour are needed, as opposed to more lines:

- **The conditional stances.** 23 of 40 arenas have no authored `fortify`,
  `scavenge`, `shadow` or `flail` action (§7.5).
- **The `gone` sanity band.** Three pools (`hallucination`, `dropItem`,
  `ruinStealth`) for a third of all tribute-time. There is no pool for *being
  around* somebody who is gone.
- **Downed.** 1.53% of tribute-cycles, three outcomes (finished 174, revived
  137, spared 135 per 160 runs), and no dedicated pool — the beats come from
  `combat` and `DEATH_TEXTS`.
- **The 16 authored legendary weapon names** that no player has seen (§1.3).

---

## §11 — More achievements to add

### 11.1 Where the layer is

170 entries, measured over 500 completed runs. **Zero rarity labels
contradicted** — the first audit at which that is true, and the credit belongs
to `npm run fix:rarity`, which writes the labels back instead of printing a
blob to paste by hand. 97 of 170 sit in the usable 5–60% band. 76 numeric
thresholds, all 76 carrying a `nearMiss`, 0 exempt. All 170 carry a hint.

Six never unlock in 500 runs: `reflection-survivor`, `every-door`,
`the-quiet-one`, `the-unwitnessed`, `rooted`, `the-short-week`. All six are
legendary and all six carry a nearMiss. That is the tail the category is for.

Four are near-automatic at ≥60%: `made-them-blink` 86.6%, `kept-word` 66.0%,
`named-early` 63.4%, `nobody-came` 61.0%.

### 11.2 Category imbalance, unchanged

```
social 48   arena 22   capitol 21   survival 21   combat 20
oddity 14   reaping 12   games 12
```

Social is 28% of the table and larger than reaping and games combined. Audit 3
reported this; reaping went 9 → 12 and oddity 10 → 14 and social did not move.
The imbalance is structural — the social layer simply has more distinct state —
but the consequence is that the achievement list reads as an alliance game.

### 11.3 Achievements to add, keyed to state that already exists

Every entry below reads only fields the engine already writes, and each names
the measurement that shows it is reachable but not automatic.

**Arena (22 → 30).** The arena category under-uses the arena.

- *Irradiated ground* — end a run having stood in an `irradiated` zone.
  Currently legendary-grade: 0 occurrences in 340 runs, so this should ship
  **with** the §1.8 fix, not before it.
- *The pass was held* — cross a `contested` edge past a live garrison.
  Same caveat: ship with §1.1.
- *The bridge behind you* — be the tribute a `collapsing` edge gives way behind.
  `countCrossing` already logs it by name.
- *Nine of ten* — stand in nine of an arena's zones. Victor coverage tops out at
  38.1% mean but reaches 46.6% at day 12; this is the honest upper rung under
  `seen-everything`.
- *Cartographer* — discover a `hidden` edge (`t.knownEdges`).
- *Weathered* — survive a weather front crossing your zone. `weatherFronts`
  runs at 454 per 400 runs and `stormsSurvived` is already tracked per tribute.
- *The ground turned* — be in a zone when a zone effect starts on it.
  `walkedIntoEffect` and `zoneEffectsCaused` both exist and neither is read by
  more than one entry.
- *Both seasons* — win in an off-season skin. `OFF_SEASON_CHANCE` is 18%.

**Games (12 → 18).** The smallest category, about the shape of the year.

- *A quiet year* — a run with no Quell, no extra disruption, and a `standard`
  temperament. 12.5% of runs draw standard.
- *All eight themes* (across the Hall of Fame) — the feast theme distribution
  is even across eight, so this is a genuine long-run collection.
- *The treacherous year* / *the lean year* / *the blitz* — one per temperament,
  6–13% each, twelve entries' worth of reachable content in a nine-member enum
  that currently drives no achievement.
- *Short week* — the run ended inside four days. Run-length sd is 2.26 days.
- *Nobody drowned* — a run with zero deaths from any water cause, in an arena
  with `water` terrain.

**Reaping (12 → 18).** The second-smallest.

- *Five motives* — the cast held all five (`family`, `prove`, `escape`,
  `honour`, `partner`). Measured distribution 935 / 747 / 734 / 568 / 436 over
  3,420 tributes, so a full house in one 24-cast is uncommon and not rare.
- *Thirteen personas* — every `InterviewPersona` used in one Games. Measured
  spread is 94–478 over 3,420, so this is a legendary and a reachable one.
- *Two quirks and a token* — `quirks.length >= 2 && token`. `secondQuirkChance`
  is a declared knob.
- *The volunteer year* — every tribute in a district volunteered.
- *The kin pair* — both tributes from one district are kin (15% per district).

**Oddity (14 → 20).**

- *Named twice* — hold an epithet and carry a legendary weapon. 8.5% and 43.3%
  of runs respectively.
- *The Argument* — win holding a weapon named from the authored pool. Ships
  with §1.3 and is the reason to fix it.
- *Swamps's Answer* — **do not add this one.** Listed so the joke is on record
  and §1.4 gets fixed instead.
- *Alone the whole way* — 42.1% of zone-samples are a single tribute; a victor
  who was alone in their zone for 90% of their cycles is a real and rare shape.
- *Stayed put* — win having moved in fewer than 10% of cycles. Population mean
  is 28.6%.
- *Down and up* — be downed, be revived, and win. 137 revivals per 160 runs and
  a much smaller number of those victors.

**Survival (21 → 26).**

- *Never frayed* — win without ever leaving the `steady` sanity band. 44.6% of
  tribute-cycles are steady but almost nobody stays there; this is the
  achievement §3.2's distribution makes interesting.
- *All the way down and back* — reach `gone` and return to `steady`.
  `sanityRecovered` already exists and is read by nothing.
- *Four skills* — end with four proficiencies at 3.0 or better. Measured means
  are 0.96–2.34, so this is rare and reachable.
- *The medic* — end with `medicine` at 3.0. The measured ceiling across 200
  runs is 3.1, so this is the hardest honest threshold in the table.
- *Scarred and standing* — win carrying two scars. 2.4% of tributes ever carry
  one.

**Capitol (21 → 24).**

- *Twelve levers* — use all twelve `GamemakerEventType`s in one run.
  `gamemakerUse` already records per-type uses and cooldowns.
- *Bought nothing* — win in `gamemakerMode` having spent on nothing.
- *The patron's year* — win with a tribute from the player's patron district,
  in a year the district's `continuity` grudge is active.

### 11.4 Two process notes

- **`test:achievements` at 500 runs measures the ceiling of every optional
  numeric on `Tribute` and `GameState` and fails on a threshold above it.** That
  is the single best check in the repository and it is why this section can
  propose thresholds with confidence. Every number above is quoted against a
  measurement in this report.
- **The near-automatic four have not moved in two audits.** `made-them-blink`
  at 86.6% is not an achievement, it is a tutorial message. Either re-scope it
  the way `performed-to-the-end` was re-scoped, or move it out of the table.

---

## Closing: the ten things worth doing first

Ordered by consequence per hour, not by section.

1. **§1.2** — one line. The "Returning victor" chip compares an id to a list of
   names and has never rendered.
2. **§1.4** — one line. `Swamps's Answer` shipped to the record book.
3. **§1.7** — one comment. `offSeason.ts` tells contributors that skins cannot
   affect balance, and 118 of 120 do.
4. **§1.3** — three lines. Sixteen authored legendary weapon names, the best
   flavour in the module, are behind a branch that cannot be reached.
5. **§1.6** — the default balance report prints two goal failures that do not
   reproduce at a sample size where they mean anything.
6. **§1.5** — replace the event-reach floor with per-run reach. The current
   guard falls when somebody adds an arena.
7. **§3.2** — the sanity distribution. p25 is zero, a third of all tribute-time
   is spent at the floor, and it is the largest category of feed line in the
   game. This is the biggest *design* finding in the report and it needs a
   metrics indicator before it needs a fix.
8. **§1.1** — author `contested`, `collapsing`, `hidden` and `oneWayAfter`
   edges across the roster, and add the check that fails when a kind has fewer
   than N instances. Sixty lines of garrison engine currently run zero times.
9. **§6.3 / §10.1** — give quirks one mechanical hook each. 85 labels already
   describe what the mechanic would be.
10. **§9.5** — the "seen it" ledger. `muttsSeen`, `quellsSeen`,
    `deathCausesInRun()` and `eventLastFired` are all already written per run,
    and unioning them into `PanemRecords` turns 27 Quells at 0.23% apiece into
    a collection instead of a lottery.

And one thing not to do: **do not add surnames.** They were removed on purpose,
the reasoning is in `names.ts:489`, and the last audit recommended re-adding
them without reading it.
