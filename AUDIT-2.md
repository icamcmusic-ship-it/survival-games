# Survival Games — second full audit (11 sections)

## Context

This is a fresh audit taken against `main` at `1da5788`, after the first
`AUDIT.md` pass and the `CHANGELOG.md` work that answered it. It is written to
the same eleven headings the first one used, and the headings are kept separate
— nothing below is merged into a neighbouring section.

Everything here is measured rather than read. The numbers come from the
repository's own check roster, run in full on this commit, plus five throwaway
instrumentation probes written for this audit and deleted afterwards. Where a
claim is "this never happens", it means a counter that stayed at zero across a
named number of complete runs, not an impression from reading the code.

### The check roster, on this commit

| check | result |
|---|---|
| `lint` | clean |
| `test:sim` (400 runs) | passes, no invariant violations |
| `test:arenas` | passes, 40 arenas + procedural |
| `test:metrics` (400 runs) | all 23 regression guards hold; 3 short of design goal |
| `test:decisions` (40 runs, 5,672 tribute-cycles) | passes |
| `test:achievements` | passes; 29 entries never unlock |
| `test:flavor` | passes; 40 packs under soft target, 277 events to go |
| `test:knobs` | 2,059 knobs, all referenced |
| `test:undeclared-knobs` | no new drift; 87 baselined sites remain |
| `test:names` | 3,200 names, 191 in two pools, none in three |
| `test:predicates` | clean |
| `test:zone-features` | 415/415 zones author an interior |
| `test:storage` | 15/15 migration cases pass |
| `test:arena-layout` | 52 layouts, no collisions |
| `test:ui` | 46/46 steps, no console or page errors |

The roster is in good health. That is the important framing for what follows:
**almost nothing below is a crash or a broken guard.** The failures in this
codebase are now failures of *reach* — systems that are wired correctly, tested
correctly, and then never actually fire in a real run because the number that
gates them sits above the range the simulation produces. The check roster is
very good at asserting that a thing works and has no vocabulary for asserting
that a thing happens.

That is the through-line. Read §1.1, §3.1, §4.1, §8.3 and §11.1 together and
they are one finding stated five times.

### The probes

Five scripts were written against `Simulator` directly, run, and removed:

1. **suspicion probe** — 60 complete runs, sampling every `memory.suspicion`
   entry on every living tribute at the end of every cycle, bucketed by whether
   the pair were in the same alliance.
2. **earned-trait probe** — 120 complete runs, diffing every tribute's trait
   list against their reaping sheet every cycle.
3. **grief probe** — 120 complete runs, counting the lover/ally branches of
   `propagateDeathFallout` and the log lines they emit.
4. **achievement-counter probe** — 150 complete runs, recording the maximum
   value every achievement-backing counter ever reached.
5. **decision probe** — 80 complete runs, 18,195 tribute-cycles, recording the
   objective and stance held and the zone-visit count at death or crowning.

---

## §1. Bugs

### Severe — a shipped mechanic is dead, or narrates wrongly

**1.1 `killTribute` dissolves the alliance before grief reads it.** This is the
most consequential bug in the repository.

`combat.ts:1393` runs `delete victim.allianceId`, and — for a two-member group —
`combat.ts:1396` deletes the survivor's too. `propagateDeathFallout` is not
called until `combat.ts:1532`, 139 lines later. That function opens with:

```ts
const wereAllied = other.allianceId !== undefined && other.allianceId === victim.allianceId;
const isLover = areLovers(other, victim);
```

Both fields have already been cleared. `wereAllied` requires
`other.allianceId !== undefined`, so it can never be true; `areLovers` matches on
a `lovers-<a>-<b>` alliance id that no longer exists on either party, so it can
never be true either.

Instrumented over 120 complete runs, the `isLover || wereAllied` branch executed
**zero times**. Independently, the `TRAGEDY:` lover-death line fired **0 times
across 120 runs**, in a sample where 19 of those runs had a live star-crossed
pair and 225 star-crossed lines were logged.

What is silently dead as a result:

- the ally grief bonus (`intensity` loses its `+25`, so every ally death is
  graded as if it were a stranger's);
- `RELATIONSHIPS.griefTowardKillerAllyBonus`, never once applied;
- the `personal` clause that lets an ally's death justify a vengeance oath on
  its own — vengeance still fires, but only via the zone/partner/distant-roll
  paths, which is a different and weaker thing than the comment above it claims;
- the lover `TRAGEDY` beat, which is one of the few hand-written set-piece lines
  in the death path;
- the `Haunted` earned trait, whose only grant site is this branch;
- and therefore `Hollow`, which requires having carried `Haunted` for six cycles
  and is unreachable by construction.

Fix: move the alliance teardown (`combat.ts:1388–1396`) to *after* the
`propagateDeathFallout` call, or capture `formerAlliance` and pass it through.
The variable `formerAlliance` already exists on line 1388 — the teardown was
written to be orderable and then ordered wrongly.

Add a soak assertion that `TRAGEDY:` fires at least once per N runs with lovers,
and that `Haunted` is granted at a non-zero rate. Neither would have needed to
exist if there had been one.

**1.2 Three earned traits are never granted.** Over 120 complete runs, diffing
every trait list every cycle:

| trait | grants in 120 runs |
|---|---|
| Bloodied | 864 |
| Starved | 380 |
| Feared | 171 |
| Silent Step | 149 |
| Marked | 139 |
| Firetouched | 126 |
| Oathbound | 115 |
| Venom-Wise | 65 |
| Merciful | 58 |
| Waterborn | 46 |
| Hardened | 44 |
| Vulture | 36 |
| Broken | 28 |
| Ruthless (conversion) | 24 |
| Star-Crossed | 22 |
| Treacherous (conversion) | 5 |
| **Haunted** | **0** |
| **Hollow** | **0** |
| **Trapwise** | **0** |

`Haunted` and `Hollow` are §1.1. `Trapwise` is separate: it is granted at
`fieldcraft.ts:187` on `trapsDisarmed >= 2`, and requires a tribute to spot
someone else's trap (`spotted`), choose to disarm it
(`TRAPS.attemptDisarmChance`), and succeed the disarm roll — twice, in a run
where the soak measures only 330 traps set and 204 triggered across 400 runs.
Three multiplied gates on an already-rare object. Either lower it to one disarm
or count `archetypeHooks.ts:265`'s bulk increment toward it (it writes
`trapsDisarmed` but the `earnTrait` call is not next to it, so the Saboteur's
own signature cannot earn the trait about disarming traps).

That is 3 of 17 earned traits — 18% of the earned tier — shipped and inert.

**1.3 Trait conversions narrate a debug placeholder to the player.**
`earnedTraits.ts` carries an `EARNED_LINES` table and falls back to:

```ts
`${t.name} is not the same person who came off the plate. [${trait}]`
```

`Broken`, `Ruthless` and `Treacherous` have no entry in that table. Measured
over 120 runs: **57 log lines** shipped with a bare `[Broken]` / `[Ruthless]` /
`[Treacherous]` suffix — exactly `28 + 24 + 5`. Those are the three trait arcs
the changelog lists as a headline feature of the last pass, and every one of
them announces itself with a bracketed identifier.

The flavour check cannot see this because it counts pool depth, not fallback
usage. Worth a check that fails on any shipped log line matching
`/\[[A-Z][a-z]+\]$/`.

**1.4 Pre-emptive betrayal has never fired.** `soak.ts` counts it:
`preemptiveBetrayals=0` over 400 runs. The cause is a threshold above the range:

`preemptiveBetrayer` needs `suspicionOf(m, o) >= 45`. Sampled over 60 complete
runs, in-alliance suspicion (902 pair-cycle samples) distributes:

| suspicion | share of in-alliance pair-cycles |
|---|---|
| 1–14 | 68.6% |
| 15–34 | 29.9% |
| 35–44 | 0.9% |
| **45–59** | **0.44%** |
| **60+** | **0.11%** |

Once eligible, the roll is `0.08 × (suspicion/100) × betrayalRate` ≈ 0.036–0.048
per pair-cycle. 0.55% of pair-cycles × ~0.04 is an expected fire rate
indistinguishable from zero, which is what the soak measures.

**1.5 The same ceiling kills the rest of the suspicion subsystem.** The same
distribution explains three more near-dead mechanics that are not currently
counted anywhere:

- `SUSPICION.departThreshold` is **60**, reached in 1 of 902 samples. The
  §4.2 pre-emptive departure is effectively dead.
- `SUSPICION.investigateThreshold` is **35**, reached in 13 of 902 samples
  (1.4%), then gated at `investigateChance: 0.25`. The soak's
  `politics: hearings=2` across 400 runs is this number.
- `ALLIANCES.factionSuspicion` gates faction detection;
  `coalitionFractures=11` across 400 runs.

The accrual side is the problem, not the thresholds alone:
`perWitnessedBetrayal: 35` is the only large grant, and it requires witnessing a
betrayal, which mostly means your own group already broke. Meanwhile
`decayPerCycle: 2` runs unconditionally and **deletes the key at zero**, so
suspicion cannot accumulate slowly across a long quiet stretch — every gap in
contact resets the relationship to "no doubt at all". Either raise the ambient
accrual (ally kill count at `perAllyKill: 8` is the right shape and too small),
or drop `preemptSuspicion`/`departThreshold` to 25/35, which is where the mass
of the distribution actually is.

Whichever is chosen, the fix is not complete without a counter in the soak. This
is a system with four thresholds, all of them set above the data.

**1.6 The `wait` objective is never held.** Over 18,195 tribute-cycles:

| objective | share |
|---|---|
| survive | 42.7% |
| reach | 21.5% |
| hunt | 18.3% |
| flee | 7.5% |
| protect | 7.2% |
| hold | 1.7% |
| stalk | 1.1% |
| **wait** | **0.0%** |

`wait` is documented in `types.ts` as "the only objective that wants nobody else
to arrive" — a deliberate, distinctive intention. It is held in no sampled cycle.
`hold` and `stalk` are within a rounding error of the same.

### Moderate

**1.7 Scars are functionally unreachable, and three systems read them.** A scar
is written in `wounds.ts:107` only when `injuryGrade(site) >= MAX_INJURY_GRADE`
*and* the tribute survives to the next `tickWoundRecovery`. Measured over 150
runs: **3 tribute-instances ever carried a single scar, and none carried two.**

Downstream, three things read a field that is almost always empty:
`stance.ts:46`'s `STANCE.visibleScarBonus` (intimidation from visible scarring),
the `one-wound` achievement (`=== 1` scar, never fires), and `BodyDiagram.tsx`.
The permanent-injury floor in `wounds.ts:132` — the "a scarred site never comes
all the way back" rule the comment is proud of — applies to essentially nobody.

**1.8 `zonesBurned` and `timesTraded` are on the schema and never written.**
Neither field is assigned anywhere in `src/`. They are not read by any
achievement, so nothing is broken; they are schema debt that `test:predicates`
does not cover because it only walks optional *booleans*. Extending that check to
optional numerics would catch both.

**1.9 Eleven achievement rarity labels contradict their measured rate.**
`test:achievements` reports them and passes, because the guard fails only at two
bands of drift:

| id | labelled | measured |
|---|---|---|
| nobody-came | uncommon | 63.0% |
| the-cold-war | rare | 27.0% |
| diplomacy-by-proxy | rare | 27.0% |
| the-purse-runs-dry | rare | 25.0% |
| quiet-booth | rare | 24.5% |
| three-names | rare | 20.0% |
| a-weapon-with-a-name | rare | 15.5% |
| it-changed-hands | rare | 15.5% |
| named-blade | rare | 15.5% |
| grand-tour | uncommon | 7.0% |
| unfilmed | uncommon | 4.0% |

`ACHIEVEMENT_EMIT_RARITY=1` regenerates these from data. There is no reason for
eleven to be standing.

**1.10 Four achievements fire on more than 60% of runs.** `kept-word` 67.0%,
`nobody-came` 63.0%, `named-early` 62.5%, `the-token` 61.0%. The check reports
them; nothing fails. A participation ribbon on a 180-entry list is the same
design failure as an unreachable entry, from the other end.

### UI bugs

**1.11 None found.** `test:ui` drives 46 interactions across every screen,
control and keyboard shortcut in Chromium and reports no console error, no page
error, and no horizontal overflow at 380px. Two independent visual checks are
also clean: `test:arena-layout` reports no label collisions at any arena size and
a 46px touch target at the 460px minimum graph width. The UI findings in §2 are
gaps, not defects.

**1.12 The Playwright browser path is stale in a clean checkout.** `test:ui`
resolves `chromium_headless_shell-1234`, which does not exist in this
environment (`chromium-1194` does). The script already honours `CHROMIUM_PATH`,
so it is a one-line note in the README rather than a code change — but the check
is excluded from CI precisely because it needs a browser, so nobody finds out
until they try.

### Knob discipline

`test:knobs` reports all 2,059 declared knobs referenced; `test:undeclared-knobs`
reports no new drift and 87 baselined sites across 22 files remaining. The
baseline is the honest measure and it has not moved. It is the one piece of
technical debt in the repository with a written-down size, which is more than
most projects manage.

---

## §2. QOL, UI and UX updates needed

The UI is in better shape than the engine. 214 ARIA attributes across 35 of 40
component/screen files, live regions on every screen that streams text, focus
management in a dedicated `useDialogFocus` hook, `prefers-reduced-motion`
honoured from both the OS and an in-app setting, a command palette, deep links,
a skip link, and a browser smoke test that passes 46 for 46. What follows is
what it does not yet do.

### 2.1 The arena has an inside and the UI never shows it

This is the single largest gap in the presentation layer.

The last pass authored a `features` block on **all 415 zones** — cover,
elevation, chokepoint, shelter quality, acoustics, and whether the zone has an
upper and a lower level — and `test:zone-features` ratchets the floor so it can
never regress. 165 zones have a chokepoint, 334 author shelter, 261 are vertical.

Grepping `src/components` and `src/screens` for `acoustics`, `chokepoint`,
`elevation`, `shelterQuality` and `vertical` returns **one hit, and it is a CSS
comment about repulsion in `arenaLayout.ts`**.

`ZoneDossier.tsx` is the component that should carry it. Its own header comment
enumerates what it surfaces — deaths, traffic, depletion, peak depletion, current
effects — and every one of those is state the *engine* tracks. None of the zone's
authored interior is there. A player cannot find out that the canyon they are
watching carries sound, that the ruins have an upper level, or that the pass is
a chokepoint, except by inference from the prose.

Edge rules, by contrast, *are* drawn (`ArenaGraph.tsx` has a glyph and a label
per `EdgeRule['kind']`). The inconsistency makes the omission more obvious: the
map explains its edges and says nothing about its rooms.

### 2.2 Systems with no surface at all

Walking every field on `GameState` and checking whether the identifier appears
anywhere in `src/components`, `src/screens`, `src/store`, `src/utils` or
`src/ui`: **53 of 97 fields are never referenced outside the engine.** Most are
correctly invisible bookkeeping. These are not:

- **`weatherFront`** — the seasonal weather system is a headline feature in the
  README ("a run rolls a direction it drifts in and the bias toward that extreme
  deepens as the run goes on; once it is established the feed names it"). The
  feed names it. Nothing shows it. There is no front indicator, no drift
  direction, no "this year is turning cold" banner. The soak measures 461
  weather fronts across 400 runs — more than one per run — and the player's only
  access to the most persistent environmental fact of the run is the prose.
- **`structuralFatigue`** — the load-bearing primitive. A `ruins` zone
  accumulates fatigue from occupation and combat noise and past a threshold
  drops on everybody in it. The player cannot see the gauge, so the collapse
  reads as a random hazard rather than as a consequence they could have watched
  coming. This is a perfect candidate for a `ZoneDossier` row: it is a number,
  it is legible, and its whole point is that it is foreseeable.
- **`abandonedCamps`** — a camp somebody fled is documented as "a real object
  now: findable, carrying salvage, and telling whoever finds it where a living
  person was and that they left fast". It has no map marker.
- **`cornucopiaHolder` / `maxHornHold` / `cornucopiaHeldSince`** — who is sitting
  on the horn and for how long is the single most important board state in the
  midgame and is not on the board.
- **`garrisonedEdges` / `edgeCrossings`** — who is holding which route.
- **`climateDrift`** — the same feature as `weatherFront`, from the other end.
- **`blocTreatiesSworn` / `allianceDeposals` / `debtsEverIncurred`** — the
  political ledger. The soak counts 102 bloc treaties and 39 expulsions per 400
  runs; a player cannot read any of it as state, only as scrollback.
- **`feastTheme` / `feastPrizes` / `quellBounty`** — what is actually on the
  table at the feast.

The pattern: **every system added in the last pass got an engine, a balance
group, a soak counter and a CI guard, and none of them got a readout.** The
chronicle is doing all the work, and the chronicle is 753 log lines per run.

### 2.3 Only four dials, against 2,059 knobs

`GameConfig` is eight fields, four of which are numeric sliders:
`districtCount`, `hazardRate`, `betrayalRate`, `sponsorGenerosity`, plus
`enableFeast`, `enableSanity`, `plainNames`, `vanillaRules`.

`data/balance.ts` holds 2,059 knobs across 127 groups. The gap between what the
engine can be told to do and what a player can ask for is enormous. Obvious
missing dials, all of which map onto knob groups that already exist:

- run length / attrition pace (the metrics sweep shows a 2.50-day standard
  deviation; the player cannot aim at either end of it);
- alliance formation rate, independently of `betrayalRate` — right now "more
  social" and "more treacherous" are one slider;
- mutt density (2,410 encounters per 400 runs, no dial);
- weather severity, independently of `hazardRate`;
- starting inventory / Cornucopia richness;
- sanity severity as a *scale* rather than the current on/off.

The six `MUTATORS` in `replayHooks.ts` are good and are the right idea, but they
are preset bundles of the same four dials. See §9.

### 2.4 Accessibility — what is missing

The base is solid. Three gaps:

- **No `alt` attribute exists anywhere in `src/`** (0 hits). There may be no
  `<img>` elements — the UI is glyph- and CSS-driven — but the arena graph is an
  SVG, and SVG needs `<title>`/`role="img"`/`aria-label` to be anything other
  than silence. `ArenaMap.tsx` does put a full `aria-label` on each zone node,
  which is the right pattern; confirm the graph container itself is labelled and
  that the decorative parts are `aria-hidden`.
- **Four `onClick` handlers on `<div>`/`<span>`** with only 7 `tabIndex` uses in
  the whole codebase. Any interactive non-button needs `role`, `tabIndex={0}` and
  a keyboard handler; at four sites this is a small, finishable job.
- **Colour is load-bearing for event categories.** There are 20 semantic
  categories driving colour coding and glyphs. There is a category-palette
  switcher in settings, which is the right accommodation, but it is worth
  confirming every category is distinguishable by glyph alone at the default
  palette — the glyph is the accessible channel and the palette switcher is the
  fallback.

### 2.5 Tedium and flow

- **The median tribute visits two zones** (§3.1). The arena map is therefore a
  mostly-static picture for most of a run. Either movement changes (§3) or the
  map needs to earn its screen space some other way — traffic history, a heat
  trail, the camps from §2.2.
- **753 log lines per run** with no summarisation layer between "the live ticker"
  and "one phase per full-width page". A per-cycle digest — three lines, what
  changed — would give a reader a third altitude to read at.
- **Auto-play brakes** exist in settings and are the best flow feature in the
  app. They are keyed to a fixed list; letting a player brake on "anything
  involving the tribute I am watching" would generalise it.

### 2.6 Settings

`SettingsPanel` covers category palette, theme, spoiler-safe viewing, units,
sound, auto-play brakes and two reset buttons. `test:storage` asserts that feed
filters and setup config round-trip. Nothing here is broken. What is missing is
a *run* settings surface distinct from a *display* settings surface — everything
in §2.3 belongs in the former and there is currently only the latter plus the
setup screen.

---

## §3. Tribute logic — robustness and more complexity

### 3.1 The median tribute experiences two zones

Over 80 complete runs, recording `visitedZones.length` at death or crowning:

| percentile | zones visited |
|---|---|
| p50 | **2** |
| p90 | 4 |
| max | **8** |

Hand-authored arenas carry 10 to 13 zones. `test:zone-features` reports 415
zones across 40 arenas — an average of 10.4 each. **The median tribute sees two
of them, and no tribute in 150 runs ever saw more than eight.**

This is the deepest structural finding in the audit and it cascades:

- The arena content budget is enormous — 1,594 authored events, 40 flavour packs,
  415 authored zone interiors, per-zone mutt terrain filters — and the median
  player-visible slice of it is two zones wide. Most of an arena is never seen in
  most runs of that arena.
- It is why `seen-everything`, `grand-cartography` and `cartographer` are
  unreachable or near-unreachable (§11.1). Those achievements are not badly
  tuned; they are asking for a thing the movement system does not do.
- It makes the map screen mostly static (§2.5).
- It caps how much arena-specific identity a run can express, which is the
  problem §5 and §7 are otherwise trying to solve by adding content.

The cause is worth measuring before it is fixed, but the shape is visible in the
objective distribution: `reach` is 21.5% of cycles and `survive` — the null
objective, which has no destination — is 42.7%. A tribute with no standing
intention has no reason to move, and the destination scorer is only consulted
when something asks for a destination.

Candidate directions, roughly in order of expected value:

1. **Give `survive` a destination.** 42.7% of all tribute-cycles are spent under
   an objective that is definitionally "no plan". Even a weak wander bias would
   roughly double map coverage.
2. **Make depletion push.** The zone economy already models forage as a
   depleting, regrowing stock, and a tribute who can read ground is pulled *back*
   toward a recovering zone. The push in the other direction — this ground is
   stripped, go elsewhere — is weaker than the pull.
3. **Let objectives name far zones.** `reach` currently resolves mostly to
   adjacent zones; a multi-cycle journey is a different and better narrative
   object than a step.

### 3.2 Stance hysteresis is doing more than intended

`test:decisions` over 5,672 tribute-cycles:

- stance held = the scorer's best choice: **56.0%**
- rank histogram: best 56.0% / 2nd 20.3% / 3rd 15.2% / **outside top 3: 8.4%**
- destination = best: 65.6%; destination in the bottom fifth of its own scoring:
  2.0%

The guard is "top three nearly always", and 8.4% outside the top three passes it.
But a tribute is holding a stance its own scorer ranks fourth or worse in one
cycle in twelve. Some of that is correct — hysteresis exists so a tribute does
not thrash — but 8.4% is a lot of decisions that the decision trace itself says
are wrong, and the soak separately reports the worst stance-change rate at 43%
of cycles against a 60% threshold, so thrash is not close to the binding
constraint. The hysteresis is likely tuned for a problem that is already solved.

### 3.3 Three stances and three objectives are vestigial

Stance share over 18,195 tribute-cycles (probe) and 400 runs (soak) agree:

| stance | probe | soak |
|---|---|---|
| Defensive | 41.9% | 16.6% |
| Evasive | 26.5% | 36.3% |
| Aggressive | 19.0% | 29.6% |
| Fortified | 4.1% | 6.1% |
| Hunting | 2.4% | 3.4% |
| Scavenging | 2.4% | 2.3% |
| Shadowing | 2.0% | 3.6% |
| Desperate | 1.8% | 2.1% |

(The two sweeps use different config spreads, which is why the top three differ;
the tail is stable across both.) The five conditional stances together account
for roughly 12–17% of cycles. Each one has an authored action pool per arena —
`test:flavor` guards `fortify`/`scavenge`/`shadow`/`flail` at 17 arenas each
plus a 12-entry generic fallback. That is a large content investment against a
small slice of play.

The objectives are worse: `hold` 1.7%, `stalk` 1.1%, `wait` 0.0% (§1.6). Three of
eight objectives are essentially not part of the game.

The fix is not necessarily "fire them more". It is that a conditional stance is
filtered out of the ranking when its situation does not hold, and those
situations are rare. Widening the situations — `wait` at any chokepoint rather
than a specific one, `hold` at any zone above a yield threshold — costs nothing
in new content because the content is already written.

### 3.4 What the decision layer still cannot represent

The two-deep objective queue, the runner-up tension, the per-kind outcome
confidence and the false-trail deception are all real and all working. Gaps:

- **No modelling of what others can see of you.** `perceivedBonds` exists on
  `Tribute` and third-party inference is implemented in `rapport.ts`, but a
  tribute has no representation of *their own* visibility — that they are the
  loudest thing in a quiet zone, or that they were seen carrying the named blade.
  `notoriety` measures 3,761 ledger entries without contact and 171 strangers
  known by name, so the information exists; nothing acts on "I am known".
- **No planning past one objective.** The queue is two deep but the second slot
  is an errand, not a second goal. "Get water, then take the horn" is not
  expressible.
- **No group-level decision.** Alliances have politics, charters, factions,
  hearings and inheritance, but no shared objective — the group does not decide
  where to go, its members each decide and happen to agree.
- **Fatigue and hunger do not change *how* a tribute thinks**, only what their
  numbers are. A starving tribute's risk curve should flatten toward desperation
  independently of the Desperate stance's gate.

### 3.5 Robustness

No robustness defect found. 400-run soak with vitals bounds, relationship bounds,
unique names and ids, no unreplaced placeholders, deterministic replay for a
fixed seed, no cycle-guard trips, zero empty pools handed to `pickOrUndefined`.
`test:storage` covers hostile input, corrupt payloads, newer-build payloads and
a v0 save. This part of the codebase is genuinely hardened.

---

## §4. Tribute relationships and alliances

### 4.1 The suspicion axis is calibrated above its own data

Stated in full at §1.4 and §1.5; restated here because it is a relationships
finding rather than a bug in isolation.

`memory.suspicion` is the per-pair doubt inside a group, and it is the input to
four separate mechanics: pre-emptive betrayal (45), pre-emptive departure (60),
investigation (35), faction detection. Measured in-alliance distribution over 60
runs, 902 pair-cycle samples: 68.6% sit at 1–14, 29.9% at 15–34, and **1.4%
reach even the lowest of those four thresholds.**

The consequences in the 400-run soak: `preemptiveBetrayals=0`, `hearings=2`,
`coalitionFractures=11`, `expulsions=39`. The machinery for group paranoia is
fully built, fully tested, and almost never runs.

The accrual asymmetry is the root cause, not the thresholds. `perWitnessedBetrayal`
is 35 and needs a betrayal to witness. `perCharterBreach` is 15. `perAllyKill` is
8 and is the only *ambient* source — the one that should carry the system. Against
that, `decayPerCycle: 2` runs every cycle unconditionally and **deletes the key
when it reaches zero**, so there is no floor and no memory of having once been
uneasy. A slow-burn distrust arc is not expressible.

### 4.2 Grief does not know who was an ally

§1.1. `wereAllied` is permanently false in `propagateDeathFallout`. Every death
is graded for every mourner as if the dead tribute were a stranger with a good
relationship score. The district-partner path (`isPartner`, keyed on district
rather than on `allianceId`) still works, which is why grief exists at all — the
soak measures 1,125 grief moments across 400 runs — but the *alliance* is not
what is generating them.

This also means the relationship system's most emotionally load-bearing
transition, "my ally died in front of me and I am not the same", is unreachable
(`Haunted`, 0 grants in 120 runs).

### 4.3 What is working, measured

Not everything here is a problem. The 400-run soak reports a genuinely dense
social simulation:

| mechanic | per 400 runs |
|---|---|
| vengeance sworn | 2,841 (9.95/run) |
| vengeance ledger closed | 289 pacts, 289 accounted endings, 0 unaccounted |
| truce ledger closed | 551 terms, 551 endings, 0 unaccounted |
| loan ledger closed | 195 made, 195 accounted, 0 still standing |
| betrayals | 5.51/run |
| merges | 140 |
| leadership changes | 85 |
| feuds | 114 |
| Career defections | 374 |
| cache contributions | 928 |
| inheritances | 1,085 |
| triangles formed | 407 (377 jealousy beats, 61 forced choices) |
| succession | 98 to a named heir, 8 passed over, 12 split the group, 62 no heir |
| debts repaid | 118 |
| charter breaches | 110 |
| district pairs | 266 |
| parley standoffs | 70 (42 paid tribute, 28 paid in information) |
| truces | 270 (102 held, 22 broken, 93 renewed, 72 lapsed, 31 turned) |
| alliance size distribution | 2:2726 · 3:1588 · 4:1157 · 5:777 · 6:329 · 7:18 · 8:2 |

Three closed ledgers with zero unaccounted entries is a serious piece of
engineering and should be said out loud. 58.6% of alliance samples are three or
more. This is not a thin system.

### 4.4 Where it is still thin

- **Bluffing is a losing play.** `bluffs: landed=59 caught=127`. A tribute who
  bluffs is caught more than twice as often as they succeed, and being caught
  raises suspicion (`PARLEY.bluffCaughtSuspicion`) in a system where suspicion
  does nothing (§4.1). The mechanic is a pure negative-expectation action that
  the decision layer presumably takes anyway.
- **Rumours barely propagate.** `planted=84 exposedAsPlant=39 exposedAsRepeated=11
  untraceable=25` across 400 runs — roughly one planted rumour every five runs,
  and half of them get exposed. `the-liar` and `whisper-campaign` both never
  unlock, which is the achievement layer reporting the same thing.
- **Bloc treaties break almost never.** `sworn=102 brokenByAKilling=5 lapsed=6
  endedByTheField=10`. 81 of 102 sworn treaties have no recorded ending in the
  counters, which is worth checking against the ledger discipline applied
  elsewhere — three ledgers close exactly and this one does not appear to.
- **Reconciliation has no counter.** `rapport.ts` implements rivalry cooling
  with quiet time and much faster with shared survival. Nothing in the soak
  measures whether it ever happens. Given the pattern in §1, that is exactly
  where an unmeasured system should be assumed dead until shown otherwise.
- **Respect is declared a currency and spends in two places.** "Who you go after
  last, and whose report your group actually acts on." Both are real; neither is
  visible to the player, and there is no third use.
- **No relationship between groups.** Alliances have rich interiors and almost no
  exteriors: bloc treaties are the only inter-group object, and they are 102 in
  400 runs. Two packs meeting has no vocabulary beyond individual pairs.

### 4.5 Concrete additions worth their cost

1. **A grudge that outlives the run.** `epithets` and the Hall of Fame already
   persist; a rivalry that a returning victor carries into a Victors' Field quell
   would make the meta layer social rather than statistical.
2. **Group-level objectives** (§3.4) — the single largest missing piece.
3. **Suspicion from absence.** Right now doubt needs an event. "You were gone for
   four cycles and came back fed" is the most natural ambient accrual in the
   fiction and would fix §4.1 in the right direction rather than by lowering a
   threshold.
4. **Public reputation as distinct from private regard.** `notoriety` tracks
   strangers knowing your name (171 instances). What the *field* collectively
   believes about you — separate from any one tribute's opinion — is the input a
   coalition needs to form against a front-runner.

---

## §5. Arenas — robustness and more complexity

### 5.1 Inventory

40 hand-authored arenas plus a procedural generator with at least three biome
families (tundra, archipelago, ruinlands are named in the validator notes). 415
zones, every one authoring its own interior. 6–14 zones per arena: 33 arenas at
6–10, 7 at exactly 11, 12 at 12–14. `test:arenas` plays every distinct stacked-law
combination on the roster to completion and asserts the laws were actually in
force.

Robustness is good. Zone graphs connected and symmetric, every arena backed by
its own flavour pack, every terrain covered by at least one mutt that can appear
on it, every climate profile matched to a briefing label, and a source scan that
catches `sort(() => rng() - 0.5)` — a seeded-shuffle bug class that no
same-process replay test could ever find. That last check is the best single
piece of test design in the repository.

### 5.2 Every arena law is a subtraction

Fourteen laws exist:

| law | arenas | engine read sites |
|---|---|---|
| noWaterExceptZone | 6 | 8 |
| noCannons | 4 | 4 |
| sponsorsFixedZone | 3 | 6 |
| openMic | 3 | 3 |
| oneWayBorders | 3 | 3 |
| fireImpossible | 3 | 3 |
| cornucopiaRefills | 3 | 3 |
| noSponsors | 2 | 5 |
| noHealing | 2 | 2 |
| noForage | 2 | 3 |
| deadlyNight | 2 | 4 |
| shrinkingArena | 1 | 3 |
| noWeapons | 1 | 6 |
| noNight | 1 | 4 |

Ten of the fourteen are prohibitions — *no* cannons, *no* sponsors, *no*
healing, *no* forage, *no* weapons, *no* night, *no* water except here. Two
(`cornucopiaRefills`, `deadlyNight`) intensify an existing system. Two
(`oneWayBorders`, `openMic`) change a rule's shape. **Not one law adds a
mechanic that does not otherwise exist.**

That is the ceiling on how different two arenas can feel. Two arenas with the
same terrain mix and different laws differ by what is switched off. Laws that
*add* would be the highest-leverage arena work available:

- a law that makes a resource tradeable or contested in a new way (an arena
  where water must be carried from one zone and spoils);
- a law that changes the win condition's shape (an arena with a hold objective —
  stand in the zone at nightfall);
- a law that adds an actor (an arena with a neutral third party, a keeper);
- a law that makes the map mutate on a schedule the players can learn
  (`moving-arena` exists as a Quell; it is not available as an arena law);
- a law that changes information (an arena where the sky shows nothing, or shows
  everything, or lies — `the-faces-lie` exists as a wildcard and not as a law).

Also: `shrinkingArena`, `noWeapons` and `noNight` are on exactly one arena each.
Three of the fourteen laws are each carried by 2.5% of the roster.

### 5.3 The arena's interior is authored and unused, in two directions

Outward: nothing in the UI shows it (§2.1).

Inward: the `requires` gates that let an event key off the interior are barely
used. Across all 1,594 authored events:

| gate | uses | share of events |
|---|---|---|
| `requires.time` | 96 | 6.0% |
| `requires.storm` | 32 | 2.0% |
| `requires.law` | 25 | 1.6% |
| `requires.elevationOrChoke` | 18 | 1.1% |
| `requires.stance` | 17 | 1.1% |
| `requires.trait` | 17 | 1.1% |
| `requires.effect` | 17 | 1.1% |
| `requires.maxSurvivors` | 13 | 0.8% |
| `requires.sanityBand` | 12 | 0.8% |
| `requires.minSurvivors` | 11 | 0.7% |
| `requires.loadBearing` | 5 | 0.3% |

`elevationOrChoke` was written specifically so "a fall" could be authored once
and be eligible in every arena with anywhere to fall from, "rather than
thirty-seven arenas each authoring their own cliff". It is used 18 times. 165
zones have a chokepoint and 261 are vertical. The primitive works and nobody is
writing against it.

`loadBearing` — the whole structural-fatigue system — gates five events. The
soak measures `trapsDestroyed=14` and does not separately count collapses, but
five events is the entire authored surface of a subsystem with its own file.

### 5.4 Arena content depth

`test:flavor` on this commit: hard floor 24, soft target 40, once-per-run floor
2. **All 40 packs are under the soft target; the thinnest are at 33; 277 events
short across the roster.** Every pack carries 4 once-per-run events and 1 chain.

A run averages 753 log lines. A 33-entry arena pack against a 30-entry generic
fallback means an arena speaks in its own voice roughly half the time, and
repeats itself inside a single Games as a matter of arithmetic. The target of 40
is the right number and the gap is real work — 277 events — rather than a
rounding issue.

Separately: `test:arenas` notes that three procedural biomes roll 14–16 zones
while `check-arena-layout` is tuned to 13. Those layouts are unverified.

### 5.5 What arenas still cannot express

- **A schedule the player can learn.** `clockwork` has bells and hours in its
  prose; the engine has `signatureBeats=375` and `calendarBeats=630` per 400
  runs, but an arena cannot declare "the tide comes in on even cycles" as data.
  A learnable, deterministic arena rhythm is the single best source of skill
  expression available to a simulator with no player inputs.
- **Zones that are not interchangeable.** Every zone is terrain + danger +
  resources + features. None of them is *a thing* — a workshop that lets you
  repair, a signal tower that reveals, a well that must be primed. Arena identity
  currently lives entirely in prose and hazard flavour.
- **Interaction between two laws.** `Arena.laws` stacks them and
  `test:arenas` plays every combination, but no law is written to *notice*
  another. `noNight` + `deadlyNight` is presumably incoherent and nothing says so.
- **Terrain is a closed enum with no sub-types.** Every `ruins` zone is the same
  kind of ruins to every system that reads terrain, including the mutt terrain
  filter and the event terrain filter.

---

## §6. Small and side features — robustness and more complexity

### 6.1 Inventory and measured activity

| feature | file | measured per 400 runs |
|---|---|---|
| Epithets | `engine/epithets.ts` | not counted |
| Legendary (named) weapons | `engine/legendaryItems.ts` | achievements fire at 15.5% |
| Gamemaker booth (12 levers) | `engine/gamemaker.ts` | 77 signatures |
| Side markets (11 prop kinds) | `engine/sideMarkets.ts` | not counted |
| Player sponsorship (31 items) | `engine/playerSponsor.ts` | — |
| Sponsor blocs | `engine/sponsorBlocs.ts` | — |
| Debts and loans | `engine/debts.ts` | 195 made, ledger closes |
| Rumours | `engine/rumours.ts` | 84 planted |
| Fieldcraft | `engine/fieldcraft.ts` | 330 traps, 300 fires, 797 shelters, 104 camouflage, 134 poisoned weapons |
| Infection | `engine/infection.ts` | 187 turned, 50 deepened, 11 terminal, 8 sepsis deaths |
| Vengeance pacts | `engine/vengeancePact.ts` | 289 sworn, ledger closes |
| Wildcards | `engine/wildcards.ts` (27 kinds) | 630 calendar beats |
| Off-season skins | `data/offSeasonSkins/` (3/arena) | 18% chance |
| Mentors | `engine/mentors.ts` | 91 cross-talk |
| Veterans / Hall of Fame | `engine/veterans.ts` | — |
| Zone control | — | 526 held, 115 payouts |
| Abandoned camps | `engine/abandonedCamps.ts` | not counted |

### 6.2 Epithets are explicitly inert

`engine/epithets.ts` says so in its own header: *"deliberately non-mechanical —
nothing reads it for a decision — because the whole point of a nickname is that
it belongs to the audience rather than to the tribute."*

The reasoning is good and the conclusion is too strong. A nickname belonging to
the audience is precisely a thing that should have mechanical weight *through*
the audience: sponsor pricing, crowd excitement, the targeting draw of being the
person everyone has heard of. `notoriety.ts` already models strangers knowing a
name. Epithets and notoriety are two implementations of the same idea that do
not touch.

Also: one epithet per tribute, ever. The comment defends this ("the first thing
they become known for is the thing they stay known for") and it is defensible,
but it means a tribute whose run changes character — the Merciful one who
becomes Ruthless, an arc the engine explicitly models — keeps the name from
before the change.

### 6.3 Named weapons are the best-realised small feature and stop short

A weapon that draws blood twice earns a name, composed from the arena's
vocabulary and the zone's, and *keeps it when it changes hands*. That is a real
proper noun and the achievements around it fire at a healthy 15.5%.

What it does not do: the name has no mechanical consequence, no history the
player can read (who has held it, what it has done), and no second tier — a
weapon that has killed six people is named exactly as much as one that has
killed two.

### 6.4 The Gamemaker booth

Twelve levers: `mutt`, `weather`, `feast`, `burn`, `flood`, `fog`, `sever`,
`bounty`, `drop`, and the three added last pass that are not harm — `mercy`,
`reveal`, `strip`. Per-lever escalating cost (`repeatCostMultiplier`) and a
per-lever cooldown. This is a well-shaped subsystem.

Gaps: nine of twelve are still harm, the three non-harm levers are all
*information or supply* rather than *rule*, and there is no lever that changes a
standing condition — no way to declare a temporary law, which is the thing a
Gamemaker in the fiction most obviously does. `gamemakerUse` is tracked per type
per run and never shown (§2.2), so a player cannot see their own escalation
curve.

### 6.5 Side markets

Eleven prop kinds: first blood, last three, district crown, Career victor, no
victor, bloodbath over/under, still running past day N, feast held, bloodless
victor, wounded victor. Priced from measured rates, which is the right way to do
it.

They are all *whole-run* propositions settled at the end. There is no in-run
market — no live line that moves, no cash-out, no proposition about the next
cycle. The odds sparkline component exists (`OddsSparkline.tsx`) and the soak
measures odds calibration (victors priced at 15.0% against a 6.9% field mean,
ratio 2.16), so the moving number is already there; nothing lets a player bet
against it mid-run.

### 6.6 Items

52 items across 7 types: 12 weapons, 11 utility, 9 food, 7 medical, 6 tool, 4
armour, 3 water. 31 of them are sponsorable. `ItemQuality` is the only thing
distinguishing two swords, which `legendaryItems.ts` calls out as the problem it
exists to solve — and it solves it only for weapons that kill.

Missing: no crafting from components (fieldcraft makes traps, fires, shelters and
camouflage but not objects), no item that changes a decision rather than a stat,
no consumable with a downside, and no item with a state other than durability.

### 6.7 Robustness

The three closed ledgers (§4.3) are the standout. `test:storage` covers fifteen
migration cases including hostile input and payloads from a newer build. No
robustness defect found in this section.

---

## §7. More ways to die, and more events

### 7.1 Current death inventory, measured

Cause-of-death distribution over 400 runs (`test:metrics`), 7,195 deaths:

| cause | share | n |
|---|---|---|
| another tribute | 55.5% | 3,994 |
| arena / hazard | 11.5% | 824 |
| bleeding | 6.7% | 485 |
| dehydration | 5.5% | 395 |
| poison | 4.8% | 344 |
| frostbite | 3.9% | 283 |
| mutts | 3.4% | 248 |
| burns | 3.3% | 236 |
| infection | 3.0% | 214 |
| starvation | 1.3% | 90 |
| border | 1.1% | 82 |

Eleven buckets. The engine carries **42 distinct hand-authored `cause:` strings**
in `src/engine/` (froze, heatstroke, ash, fog front, dust front, drowned in the
plates, walked off a bearing, unravelled in the half-light, and so on), and the
1,594 authored arena events each carry their own — so the *prose* vocabulary is
very wide and the *mechanical* vocabulary is eleven.

This is the right diagnosis to keep in mind for this section: the game does not
need more ways to write a death. It needs more mechanically distinct ways to
reach one.

### 7.2 Event inventory and gating

1,594 authored events across `arenaFlavor.ts`, four `arenaEvents/` group files
and `proceduralBiomeEvents.ts`. Field usage across all of them:

| field | uses | share |
|---|---|---|
| cause | 1,594 | 100% |
| dodgeStat | 1,336 | 83.8% |
| damage | 1,217 | 76.3% |
| terrains | 1,097 | 68.8% |
| sanity | 538 | 33.8% |
| dodgeDifficulty | 460 | 28.9% |
| dodgeAlt | 459 | 28.8% |
| bleeding | 448 | 28.1% |
| fatigue | 379 | 23.8% |
| requires | 228 | 14.3% |
| oncePerRun | 195 | 12.2% |
| zoneWide | 184 | 11.5% |
| heal | 174 | 10.9% |
| witnesses | 163 | 10.2% |
| quench | 142 | 8.9% |
| feed | 134 | 8.4% |
| startsZoneEffect | 132 | 8.3% |
| frostbitten | 117 | 7.3% |
| burned | 114 | 7.2% |
| poisoned | 113 | 7.1% |
| infected | 84 | 5.3% |
| grantItem | 76 | 4.8% |
| weight | 74 | 4.6% |
| thirst | 72 | 4.5% |
| chain | 53 | 3.3% |
| severesRoute | 39 | 2.4% |
| special | 37 | 2.3% |
| hunger | 8 | **0.5%** |

The modal event is: a dodge roll against one stat, some damage, a terrain filter.
83.8% roll a dodge; 76.3% do damage. The schema's expressive parts — chains
(3.3%), route severing (2.4%), `special: collapse|startsQuaking` (2.3%), hunger
(0.5%) — are rounding errors.

`special` is a closed union of exactly two members (`collapse`, `startsQuaking`)
and is the designated extension point for "a mechanical consequence beyond the
stat block". Two members, 37 uses. That union is where new *kinds* of death
belong and it has barely been opened.

### 7.3 Universal deaths worth adding (usable in every arena)

Each of these is expressible in the existing schema plus one or two new `special`
members, and each is a mechanically distinct way to die rather than a new noun
for an existing one.

1. **Falling, properly.** `requires.elevationOrChoke` exists and is used 18
   times; 261 zones are vertical. A fall between levels during a fight, a
   retreat, or a night move — one authored event, eligible in most of the roster.
2. **Structural collapse you could have seen coming.** `loadBearing` gates five
   events. With the fatigue gauge surfaced (§2.2), a collapse becomes a death the
   player watched approach, which is the most satisfying kind.
3. **Exhaustion as a terminal state, not a drain.** `Collapsed from exhaustion`
   exists as a cause string; fatigue is 23.8% of events as a *cost*. A tribute
   who has not slept for four cycles should be able to simply stop.
4. **Drowning under load.** Carry capacity and `enforceCapacity` exist; a water
   crossing while overloaded is a death the inventory system already has the
   inputs for. 654 overloaded drops per 400 runs says the state is common.
5. **Friendly fire and the group fight.** 2,643 group fights per 400 runs and no
   cause string for being killed by your own side in the confusion.
6. **Cold sleep.** Sleep deprivation is modelled (`deprivedDrops=159`),
   frostbite is 3.9% of deaths; sleeping in the open in the wrong weather is the
   join between them and does not exist.
7. **Thirst from salt or blood loss**, rather than only from a dry zone — 6.7% of
   deaths are bleeding and 5.5% are dehydration and they do not interact.
8. **Being buried.** `startsQuaking` exists as a `special`. A tribute pinned
   rather than killed, who then needs rescue or dies, uses the `downed`/rescue
   window system that already exists for combat and has no non-combat entry.
9. **Infection reaching a limb rather than a bloodstream** — amputation as a
   survivable catastrophe. `scars` and `InjurySite` already model per-site state
   and §1.7 shows that state is almost never reached.
10. **Poisoned water at the shared source** — a death that kills several people
    who never met, which the engine has no current shape for.

### 7.4 Arena-specific deaths worth adding

Every arena already ships two signature deaths. The roster is 40 arenas and
`test:flavor` says all 40 packs are 7+ events under target. The natural place to
spend those 277 events is on *reactive* and *once-per-run* entries rather than
more ambient ones, because those are what make one run of an arena differ from
the next.

Specifically under-served, by the gate-usage table in §5.3:

- **`requires.minSurvivors` / `maxSurvivors`** (11 and 13 uses across 1,594
  events). An arena that behaves differently when the field is down to four is
  the cheapest endgame variety available and almost nothing uses it.
- **`requires.sanityBand`** (12 uses). A death that only happens to someone who
  has stopped thinking clearly is a category the game models thoroughly and
  writes about twelve times.
- **`requires.trait`** (17 uses). 62 traits exist. A Pyromaniac-only death, a
  Fire-Shy-only death, a Climber's fall — the character sheet is not currently a
  source of arena events.
- **`requires.stance`** (17 uses). Eight stances. A death that only finds someone
  who is Fortified, or only someone who is Scavenging, uses content already
  authored per arena for exactly those stances.
- **`requires.law`** (25 uses across 14 laws). A law-specific death per law would
  be 14 events and would make the laws feel like places rather than switches.

### 7.5 More events generally

- **Chains are 3.3% of events.** 53 chain links across 1,594. A two-part setup
  and payoff on the same tribute next cycle is the single most memorable event
  shape the schema supports, and every arena has exactly one.
- **Positive events are 8–11%** (`heal` 10.9%, `quench` 8.9%, `feed` 8.4%). The
  schema comment says "not every arena event is a punishment" and nine in ten of
  them are.
- **`witnesses` is 10.2%.** An event that other people saw is how an arena
  generates social consequence from environmental content, and it is off by
  default nine times in ten.
- **No multi-tribute events.** `zoneWide` (11.5%) hits everyone in a zone with
  the same effect. There is no event whose outcome depends on *who else* is
  there — no event that two tributes resolve differently together than apart.

---

## §8. Trait and archetype balance audit

### 8.1 Archetypes — the balance work landed

All 23 regression guards in `test:metrics` hold, and the archetype ones have
moved a long way:

| indicator | measured | was | guard | goal |
|---|---|---|---|---|
| win-rate spread (best/worst) | **1.67x** | 4.6x | ≤4.6 | ≤2.3 met |
| worst archetype win rate | **4.32%** | 2.56% | ≥2.0% | ≥3.5% met |
| best archetype win rate | **7.20%** | 11.8% | ≤13% | ≤8% met |

Full table (400 runs):

| archetype | n | win% | avg days | avg kills | signature fire rate |
|---|---|---|---|---|---|
| survivalist | 778 | 7.20% | 4.35 | 0.39 | 59.6% |
| career | 846 | 7.09% | 4.42 | 0.86 | 55.3% |
| saboteur | 271 | 6.27% | 3.63 | 0.40 | 43.2% |
| trickster | 695 | 5.76% | 3.51 | 0.62 | 48.6% |
| underdog | 863 | 4.98% | 3.88 | 0.34 | 55.7% |
| zealot | 278 | 4.68% | 2.97 | 0.55 | 40.6% |
| diplomat | 279 | 4.66% | 3.80 | 0.34 | 50.9% |
| strategist | 676 | 4.44% | 3.68 | 0.43 | 50.9% |
| wildcard | 643 | 4.35% | 3.37 | 0.68 | 45.4% |
| scholar | 322 | 4.35% | 3.70 | 0.30 | 53.1% |
| protector | 833 | 4.32% | 3.93 | 0.52 | 51.6% |
| beast | 191 | 4.19% | 2.86 | 0.88 | 44.0% |
| medic | 273 | 4.03% | 3.76 | 0.38 | 45.1% |
| mercenary | 328 | 3.05% | 3.30 | 0.64 | 40.9% |
| ghost | 324 | 2.78% | 4.19 | 0.34 | 46.9% |

Signature fire rate is between 40.6% and 59.6% for all fifteen — a tight,
healthy band. This is solved.

### 8.2 Archetypes are still under-differentiated in *kind*

The `ArchetypeDef` header makes the right argument: four scalars can only differ
by degree, so the hooks exist to differ in kind. Coverage of those hooks:

| hook | archetypes carrying it |
|---|---|
| stanceBias | 15/15 |
| objectiveBias | 15/15 |
| signature | 15/15 |
| tagline | 15/15 |
| hatesArchetypes | 13/15 |
| targetPreference | 15/15, but **6 of them are `nearest`** |
| riskCurve | 15/15, but **8 of them are `flat`** |
| fearScale | 4/15 |

`nearest` is the null targeting preference and `flat` is the null risk curve.
**40% of archetypes do not differentiate on who they attack, and 53% do not
differentiate on how their caution moves across a run** — the two hooks that were
added specifically to make archetypes differ in kind. The vocabulary is five
target preferences and three risk curves; filling those two columns properly
costs nothing but judgement.

`fearScale` is worse: it was introduced because `archetype === 'zealot'` was a
hardcoded carve-out with no counterpart at the other extreme, and it now has four
values on fifteen archetypes. The other eleven are implicitly 1.

Two archetypes have no declared antipathies.

### 8.3 The three archetypes that are not fine

- **Ghost: 2.78% win, the longest survival of any low-performer (4.19 days),
  0.34 kills.** Ghost survives and does not win. It clears the guard because the
  guard is ≥2.0%, but it is 38% of the best rate. A stealth archetype that
  outlasts and cannot close is a design statement, and if it is intentional it
  should be stated; if it is not, the endgame cover-stripping the README
  describes ("the Gamemakers strip cover away once the field is down to the last
  few") is the mechanism that specifically punishes it.
- **Mercenary: 3.05%, and 40.9% signature fire rate — the second-lowest.** The
  metrics note attributes the low fire rate to dying fastest. The retainer
  contract that defines the archetype is measured in `on-retainer`, which
  **never unlocks** (§11.1) because `retainersHonoured` never exceeds 1 in 150
  runs. The archetype's defining mechanic runs at most once per tribute, ever.
- **Beast: 191 entrants, 2.86 days, 0.88 kills, 4.19%.** Highest kill count in
  the game and the second-shortest life. That is a coherent character; it is also
  the smallest sample on the roster and is not guarded.

### 8.4 Traits — power level

`test:metrics` buckets every numeric modifier by category and sums magnitude per
trait. Outliers past 1.5 standard deviations:

| category | n | mean | sd | outliers |
|---|---|---|---|---|
| combat | 25 | 0.89 | 0.92 | **Hardened 3.45 (+2.8sd)**, Unremarkable 2.92 (+2.2sd) |
| social | 6 | 0.73 | 0.24 | Oathbound 0.35 (−1.6sd) |
| survival | 27 | 0.87 | 0.62 | **Waterborn 2.54 (+2.7sd)**, Broken 2.00 (+1.8sd) |

Two things stand out.

**Hardened is the most heavily-modified combat trait in the game and its holders
win 0.86% of the time** — against a field mean near 5%. 116 holders in 400 runs.
Earned traits measure survivorship rather than power, so a low win rate is
expected for a trait granted at a near-death moment; but Hardened is granted to
survivors of something, and 0.86% is not "survivorship bias", it is the worst
number in the earned table by a factor of ten. Either the grant condition selects
for tributes who are already dead, or the trait's 3.45 combat magnitude is
pointed the wrong way. It is worth an afternoon.

**Only 6 traits carry social modifiers at all**, against 25 combat and 27
survival. The social layer is the richest part of the simulation (§4.3) and the
character sheet barely engages with it. `persuasion` and `rapport` hooks were
added last pass; six traits use them.

### 8.5 Traits — the reaping pool

Reaping-assigned win rates spread 1.98x (8.97% Hydrophilic to 2.61% Scavenger),
against a guard of ≤4.5 and a goal of ≤2.5. Met. The metrics file correctly warns
that a trait far off the mean with a large n is as likely to be measuring *who
receives it* as what it does.

Two notes the table supports:

- **Scavenger at 2.61% (230 holders) is the worst reaping trait by a clear
  margin** — the next worst is Charismatic at 3.51%. The Scavenging stance is
  2.3% of cycles and corpse-stripping is gated behind `bodyStripChance`. A trait
  whose whole purpose is a stance nobody holds.
- **Charismatic at 3.51% with 797 holders** is the largest sample in the bottom
  three. Charisma's mechanical reads are sponsor trust, interviews and the two
  social hooks — all of which are pre-arena or slow. The trait with the most
  holders in the pool is one of the three worst.

### 8.6 Earned traits

17 exist. 3 are never granted (§1.2). Of the 14 that are, the grant frequency
spans 864 (Bloodied) to 22 (Star-Crossed) over 120 runs — a 39x spread. Bloodied
is granted to essentially everyone who kills, which makes it a state flag rather
than a character change.

Suggested: split Bloodied into a first-kill beat (universal, narrative) and a
rarer trait for the kill that actually changed someone.

---

## §9. Replayability, and keeping the game from going stale

### 9.1 The variety layer is large and mostly invisible

Per-run variation currently comes from: **40 arenas** + a procedural generator,
**9 Games temperaments**, **8 cast shapes**, **27 wildcards**, **28 Quells**, **6
mutators**, **3 off-season skins per arena** at an 18% chance, a daily seeded
run, and a featured-arena rotation that prefers arenas the player has not seen.

That is a genuinely deep combinatorial space. The list:

- temperaments: conventional, lean, lavish, hostile arena, slow, treacherous,
  short, blitz, attrition
- cast shapes: ordinary reaping, unusually young field, field of eighteens,
  all-volunteer year, stacked with Careers, a year the outer districts fear,
  bonded pairs, field of victors
- wildcards (27): nothing, early feast, double feast, no feast, mutt release,
  supply drop, weather front, sponsor freeze, sponsor flood, gamemaker
  malfunction, career collapse, rule change (allies), rule change (no allies),
  blackout, drought, bounty, bounty on the hidden, drop between rivals, cannon
  misfire, mentor broadcast, cleansing rain, mutt migration, the faces lie,
  quarter quell pairs, quarter quell doubled, silent arena, crowd revolt
- Quells (28): bonded pairs, victors' field, doubled reaping, no alliances,
  mandatory alliance, silent games, sponsors, volunteers, the youngest, the
  elders, cornucopia forfeit, moving arena, two victors, bounty, tribute's
  choice, long games, feast, the reflection, weapons, blood debt, feral, lean,
  open wallet, endless day, cold, feeding ground, single drop zone, thirst

The problem is not the amount. It is that the *run-shaping* layer and the
*per-run outcome* layer barely interact, and the player has very little agency
over either. See 9.2 and 9.3.

### 9.2 The run-length distribution says runs are more similar than the content suggests

`test:metrics`: average 8.7 days, standard deviation **2.50** (guard ≥1.4, goal
≥2.0, met). `test:sim`: average 6.8 days over a wider config spread. Feast in 179
of 400 runs. Victors in 393 of 400; wipeouts 3.0%.

And:

- **victors average 1.61 kills**, with **30.2% of victors taking zero kills**
  (guard ≤32%, goal ≤25%, unmet);
- **34.0% of the field dies in the bloodbath** — a third of every run's deaths
  happen in one phase, on cycle zero, before any of the social or arena systems
  have had a chance to run;
- **Careers win 45.9%** (guard ≤50%, goal ≤45%, unmet), and the top three
  districts take 45.9% combined.

The shape of a run is therefore fairly reliable: a big bloodbath, an attrition
middle, a low-kill victor. The 40 arenas and 28 Quells are decorating a
consistent curve.

Three indicators clear their guard and miss their design goal, and all three are
about the same thing — the game wants outcomes to be more varied than they are:
zero-kill victors (30.2% vs ≤25%), no-victor runs (3.0% vs ≤2%), Career victors
(45.9% vs ≤45%).

### 9.3 The player has four dials and no choices

Restating §2.3 from the replayability side. `GameConfig` is four numeric dials
and four booleans. There is no in-run decision the player makes that changes an
outcome except the Gamemaker booth (which requires gamemaker mode) and
sponsorship.

For a simulator, the replayability question is "what makes me start another run",
and the honest answers today are: a different arena, a different Quell, and the
Hall of Fame. Missing:

- **A goal for the run other than watching it.** Achievements are the only
  standing objective and 29 of them cannot be reached (§11.1).
- **A reason to prefer one arena.** The featured-arena rotation is a good nudge
  and the only one.
- **Any persistence between runs beyond records.** Victors go into the Hall of
  Fame and can return in a Victors' Field Quell. Nothing else carries — no
  district that gets stronger, no rivalry that persists, no unlock that changes a
  later run.

### 9.4 The highest-leverage anti-staleness work

In rough order of expected value per unit of effort:

1. **Fix the map (§3.1).** A median of two zones visited means the 40-arena
   roster is currently 40 lightly-different two-room experiences. Nothing else in
   this section matters as much.
2. **Let arenas add rather than subtract (§5.2).** Fourteen prohibitions cannot
   make forty arenas feel different from one another.
3. **Make the campaign layer real.** Districts already carry a Games record and a
   legacy tier that measurably affects win rate (storied 7.3% vs forgotten 3.9%).
   Letting that record *move* across runs — a district that wins climbs, a
   district that goes decades without climbing falls — turns 40 arenas into a
   season rather than a shuffle.
4. **Surface the run-shaping layer.** A player who cannot see that this is a lean
   Games with a young field and a scheduled mutt release is playing the same game
   every time regardless of how much variety the generator produced. Nine
   temperaments and eight cast shapes are a lot of variety to keep off-screen.
5. **Give the bloodbath a decision.** A third of all deaths in one phase with no
   player input is the largest single block of unengaged time in a run.

---

## §10. Shallow or incomplete mechanics, and flavour breadth

### 10.1 Mechanics that are shallower than they look

**Mutts.** 196 mutts across the roster. `MuttRole` is a seven-member union —
ambusher, herder, scavenger, siege, mimic, swarm, parasite — and is the whole
behavioural layer above the stat block. Usage:

| role | mutts |
|---|---|
| ambusher | 18 |
| herder | 13 |
| mimic | 11 |
| siege | 11 |
| swarm | 9 |
| scavenger | 7 |
| parasite | 5 |
| **no role at all** | **122 (62%)** |

The `Mutt` interface header explicitly describes the problem it was built to
solve: "Tick-Tock Monkeys and Acid Fog were mechanically identical." 62% of the
roster is still that. Other flags are healthier — `inflicts` on 131, `fearAura`
on 73, `nocturnal` on 37, `persistent` on 35, `homeZone` on 11 — but role is the
one that makes a mutt *behave*, and most mutts do not.

**Scars.** Effectively unreachable — 3 tribute-instances in 150 runs (§1.7). The
per-site injury model, the permanent-damage floor, the intimidation bonus and the
body diagram are all built on a state almost nobody enters.

**Epithets.** Deliberately inert (§6.2), one per tribute forever, not read by any
system.

**Named weapons.** Earned, persistent across owners, and mechanically inert
(§6.3).

**Bluffing.** Negative expectation (59 landed, 127 caught) feeding a suspicion
axis that does nothing (§4.4).

**Rumours.** One planted every five runs; half exposed (§4.4).

**The `wait`, `hold` and `stalk` objectives.** 0.0%, 1.7%, 1.1% (§3.3).

**Three earned traits.** Never granted (§1.2).

**Pre-emptive betrayal, pre-emptive departure, investigations, faction
detection.** All gated above their data (§4.1).

**`special: 'collapse' | 'startsQuaking'`.** The designated extension point for
non-stat event consequences: two members, 37 uses in 1,594 events (§7.2).

**`requires.loadBearing`.** Five events for a whole subsystem (§5.3).

### 10.2 Systems that are deep and should be said so

For balance, and because it affects where work should go: combat (multi-round
with per-round retreat, group fights with numbers advantage and focus fire,
per-point damage attribution), the memory ledger, the relationship graph, the
three closed ledgers, the zone economy, the physique model (frame and condition
as independent axes, condition degrading under starvation), exposure and climate
as one object, alliance politics (factions detected rather than declared,
hearings, cache-contribution claims), and the balance-knob discipline with its
two-directional CI guard. None of these is shallow.

### 10.3 Flavour breadth — what is measured

`test:flavor` on this commit:

- 21 flat flavour pools, smallest at 12, target 12, **0 under target**
- 137 nested pools, floor 8, thinnest `ARCHETYPE_SIGNATURE_TEXTS.careerDeclaration`
  at exactly 8, **0 under floor**
- 85 quirks, thinnest at 4 line variants (floor 4)
- 13 interview personas × 15 success + 15 failure scenarios, all at target
- 4 conditional-stance action pools × 17 arenas authoring each, generic fallback 12
- **40 arena packs, thinnest 33, all 40 under the soft target of 40, 277 events
  short**

Every floor is met and every ratchet holds. The one real gap is the arena packs.

### 10.4 Flavour breadth — what is thin in kind rather than in count

Counting entries is not the same as counting *types*. Several surfaces are at
their floor with only one shape of entry:

- **Quirks: 85 of them, 4 line variants each at the thinnest, and all of them are
  the same kind of thing** — an idle-beat habit. There is no quirk that is a
  verbal tic in dialogue, none that is a thing another tribute notices about you,
  none that changes under stress. A quirk is a line that fires when nothing is
  happening.
- **Interview personas: 13**, each with 15 success and 15 failure scenarios. That
  is 390 authored scenarios and thirteen ways to be a person on a couch. The
  persona set (star-crossed lover, ruthless warrior, humble underdog, mysterious
  enigma, charming flirt, arrogant brute, quirky oddball, silent threat, grieving
  sibling, cold strategist, reluctant hero, district loyalist, wildcard) is the
  standard set; missing are the ones that would produce a different *kind* of
  interview — the one who will not perform, the one who is obviously lying, the
  one who talks about someone else.
- **Epithets** are drawn from a small set of kinds (`bloody`, and the others in
  `EPITHETS`). Given one per tribute forever, the kind vocabulary matters more
  than the entry count.
- **Head Gamemakers: `HEAD_GAMEMAKERS` is a profile list** and each profile
  presumably biases the year. This is one of the better-shaped flavour systems
  and is not surfaced in the setup screen's briefing.
- **Stylists, chariot angles, goodbye scenes, train scenes, reaping crowds,
  district tokens** all exist in `pregames.ts`. These are the richest
  pre-arena flavour surface and the one the player sees for the shortest time.

### 10.5 Suggested flavour *types* to add

1. **A second quirk kind: the observed quirk.** What other tributes notice about
   you, surfaced in their memory and in the chronicle from their point of view.
2. **A third: the stress tic.** A quirk line that only fires below a sanity band —
   `requires.sanityBand` already exists in the event schema and is used 12 times.
3. **Family and home.** Every tribute has a district, a legacy tier, a token and a
   goodbye scene, and no named person waiting. One named relation per tribute
   would give the epilogue, the interview and the death card a referent they
   currently lack.
4. **Surnames.** See §11.2 — the game has no family names at all.
5. **Mentor voice.** 124 mentors, 91 cross-talk beats per 400 runs. A mentor with
   a *manner* (as head Gamemakers have) rather than a name and a record.
6. **Commentary as a character.** The chronicle speaks in one voice. Two
   commentators who disagree is the cheapest possible way to double the
   perceived variety of 753 log lines.

---

## §11. More achievements, and more names

### 11.1 Achievements — current state

180 entries in `data/achievements.ts`; `test:achievements` evaluates 158 in-run
predicates against a few hundred real end-states.

By category: social 46, survival 22, combat 20, arena 20, capitol 19, games 12,
oddity 10, reaping 9.
By rarity: rare 67, uncommon 47, legendary 23, common 21.
99 entries carry a `nearMiss`; all 77 numeric-threshold tests do.

Measured coverage: **87 of 158 land in the usable 5–60% band. 29 never unlock. 4
fire on more than 60% of runs.** 11 rarity labels contradict the measured rate
(§1.9).

### 11.2 Why the 29 never unlock — this is not a tuning problem

Probing the backing counters over 150 complete runs, recording the maximum value
each ever reached anywhere in any run:

| counter | max reached in 150 runs | achievement | asks for |
|---|---|---|---|
| `trapKills` | **1** | `the-trapline` | ≥3 |
| `trapKills` | **1** | `deadfall` | ≥2 |
| `intelSold` | **2** | `arms-dealer` | ≥3 |
| `retainersHonoured` | **1** | `on-retainer` | ≥2 |
| `zoneEffectsCaused` | **1** | `scorched-earth` | ≥3 |
| `diedWithinReach` | **2** | `within-reach` | ≥3 |
| `visitedZones` | **8** | `seen-everything` | every zone (10–13) |
| `visitedZones` | **8** | `grand-cartography` | all but one of 12+ |
| `scars` | **1**, on 3 tributes ever | `one-wound` | exactly 1 |
| `finishedDowned` | 3 | `the-executioner` | ≥3 (reachable, barely) |
| `corpsesLooted` | 7 | — | — |

**Eight of these are arithmetically unreachable**, not merely rare. No amount of
runs produces them, because the counter has a ceiling below the threshold. They
are not hard achievements; they are promises the game cannot keep, and the
coverage report lists them alongside the genuinely hard ones, which hides them —
exactly the failure mode `nobodys-ally` had before `test:predicates` existed.

`test:predicates` catches the boolean version of this bug and stops at booleans.
**The single highest-value check to add is the numeric version**: for every
achievement comparing an optional numeric field against a threshold, assert that
the engine can produce a value at or above it. That check would have flagged all
eight of the above on the day they were written.

The remaining 21 never-unlocked entries split into three groups:

- **Downstream of a §1 bug**: anything reading `Haunted`/`Hollow`, and the
  rumour entries (`the-liar`, `whisper-campaign`) which need a rumour system that
  plants 84 times in 400 runs.
- **Downstream of §3.1**: every cartography and exploration entry.
- **Genuinely hard and fine**: `hairsbreadth`, `borrowed-time`, `the-unwitnessed`,
  `fever-dream`, `every-district-bleeds`, `the-long-walk`.

Six of the 29 carry no `nearMiss` at all — `the-liar`, `caught-out`,
`nobody-is-buying`, `took-the-marked-pack`, `treaty-year` — so a player gets no
signal that they exist as anything but a locked row.

### 11.3 Achievements worth adding

The category distribution is lopsided: social 46, oddity 10, games 12, reaping 9.
The three thinnest categories are the three most interesting to a returning
player, because they are about the *shape of a year* rather than one tribute's
stat line.

Twenty suggestions, each backed by state the engine already tracks:

**games (the shape of the year)**
1. A year where the feast was never called and the field still fell below four.
2. A year where every district lost both tributes before day four.
3. A year where the bloodbath took fewer than a quarter of the field
   (`share of the field lost in the bloodbath` is measured at 34.0% with a 25–62%
   guard — the low tail exists).
4. A year that ended with no cannon fired after day two.
5. A Quell that produced the outcome the Quell was written to prevent.

**oddity**
6. A victor who never held a weapon (69.4% of the board carries one; the inverse
   is measurable).
7. A victor who never left the zone they landed in — currently *more* likely than
   `seen-everything`, given a median of two zones visited.
8. A run where the last two standing had a truce that never broke.
9. A run where more tributes died to the arena than to each other
   (`arena/hazard + mutts` is 14.9%; the tail exists).
10. A tribute who swore vengeance on someone who was already dead.

**arena**
11. A collapse that took three or more tributes (`special: 'collapse'`, 61 uses).
12. A run where a route was severed and never reopened (`severesRoute`, 39 uses).
13. A run where every once-per-run event in the arena fired.
14. A zone that went from full stock to the floor and back to full.

**capitol**
15. A run where every Gamemaker lever was pulled at least once (12 levers,
    escalating cost — a real constraint).
16. A mercy parachute that saved someone who then won.
17. A prop bet settled at the longest price on the board.

**social**
18. An alliance that formed in the bloodbath and was still intact at the final
    three (`largestSeen=7`, `organicGroupsOf3Plus=1201`).
19. A tribute who was betrayed twice by two different people and won.
20. A vengeance pact paid by the person who swore it (`paidThemselves=55` per 400
    runs — rare, real, and currently uncelebrated).

Before adding any of these: fix the eight unreachable ones and add the numeric
predicate check, or the list gets longer and the 5–60% band does not.

### 11.4 Names — current state

`test:names` on this commit: **3,200 names across 16 districts**, 100 per district
per gender. 191 appear in two pools; none in three. **124 mentors** across 16
districts, every pool at least 6 deep, none shared. No themed name has wandered
out of its district.

The naming conventions are well-designed and documented: three formation styles
mixed per pool (literal nouns, phonetic twists on industry words, real names that
echo the theme), Careers leaning ornate and Roman, outer districts leaning on
grounded everyday nouns, and District 12 split along Seam/merchant class lines.
This is the most carefully-thought-through content file in the repository.

### 11.5 What the name layer is missing

**No surnames, anywhere.** Every tribute in the game is a single given name.
That is a defensible stylistic choice and it costs three things: there is no
family, so a sibling or a cousin from a previous Games cannot be expressed; there
is no district naming *lineage*, so a storied district's legacy has no
onomastic texture; and the Hall of Fame is a list of first names, which becomes
harder to read as it grows. A surname layer — 40–60 per district, following the
same three-formation rule — would be roughly 800 entries and would open all
three.

**Gender is binary in the schema.** `DISTRICT_NAMES` is
`Record<district, Record<Gender, string[]>>` and `Gender` is Male/Female. A
reaping that can only produce two kinds of person is a constraint on the cast
generator as much as on representation. A third pool per district (or a shared
unisex pool drawn from the existing literal-noun formation, which is already
gender-neutral in kind — Chaff, Spruce, Flint, Onyx) would be ~500 entries.

**Mentors are thin relative to tributes.** 124 mentors against 3,200 tribute
names. Six per district is enough to avoid repetition within a run and not enough
for a district to have a recognisable mentor *tradition* across a campaign.

**No name carries a record.** A name drawn from District 2's pool is
indistinguishable from any other District 2 name. Marking a subset as "names that
have won before" — and having the reaping notice when one comes up again — is a
one-field change that would make 3,200 names feel like a population with a
history.

### 11.6 Names worth adding

| pool | current | suggested add | why |
|---|---|---|---|
| surnames | 0 | ~800 (50/district) | family, lineage, Hall of Fame legibility |
| unisex / third gender pool | 0 | ~500 | cast variety and the schema constraint |
| mentors | 124 | +200 (to ~20/district) | a district mentor tradition |
| epithet kinds | small | +6–8 kinds | one per tribute forever makes kind matter more than count |
| head Gamemakers | profile list | +manner/voice per profile | the year's author should be audible |
| named weapon templates | 5 compositions | +8–10 | a weapon that kills six is named like one that killed two |
| district tokens | present | +3/district | the token is in the goodbye scene, the interview and the death card |

The 191 names resident in two districts are fine and deliberate (the check allows
two and forbids three). No action needed there.

---

## Recommended order of work

Ordered by expected value, not by section number. Sections are named so each
item can be traced back.

### First — the things that are broken and cheap

1. **Move the alliance teardown after `propagateDeathFallout`** (§1.1). One
   reordering in `combat.ts`. It restores ally grief grading, the lover
   `TRAGEDY` beat, the ally vengeance bonus, `Haunted` and — transitively —
   `Hollow`. This is the highest ratio of value to lines changed in the
   repository.
2. **Write the three missing `EARNED_LINES`** (§1.3). 57 log lines per 120 runs
   currently ship a bracketed debug identifier to the player. Three sentences.
3. **Re-derive the eleven drifted rarity labels** (§1.9). One command.
4. **Add the numeric half of `test:predicates`** (§11.2). Catches eight
   arithmetically unreachable achievements today and every future one on the day
   it is written.
5. **Add a check that fails on any shipped log line ending in `[Word]`** (§1.3).

### Second — the calibration cluster

6. **Recalibrate the suspicion axis to its own distribution** (§1.4, §1.5, §4.1).
   Four thresholds (45/60/35/faction) sit above a distribution where 98.5% of
   samples are under 35. Prefer fixing the accrual — ambient doubt from absence
   and from an ally's kill count — over lowering the thresholds, and stop
   `decayPerCycle` deleting the key at zero. Add soak counters for pre-emptive
   departure, investigation and reconciliation; all three are currently
   unmeasured and should be assumed dead until counted.
7. **Fix `Trapwise`** (§1.2) — one disarm, or count the Saboteur signature's
   increment.
8. **Lower the eight unreachable achievement thresholds to the measured
   ceiling**, or raise the ceiling deliberately (§11.2).
9. **Look at `Hardened`** (§8.4): the most heavily-modified combat trait in the
   game, 116 holders, 0.86% win rate.

### Third — the structural one

10. **Fix map coverage** (§3.1). Median two zones visited out of ten to thirteen.
    This caps the value of every arena, event and zone-interior investment
    already made, and it is the reason four achievements cannot fire. Start by
    giving the `survive` objective — 42.7% of all tribute-cycles — a destination
    bias.

### Fourth — content with the best leverage

11. **277 arena events to reach the soft target** (§5.4), spent preferentially on
    `requires.minSurvivors`/`maxSurvivors` (24 uses in 1,594), `sanityBand` (12),
    `trait` (17), `stance` (17) and `law` (25) — the gates that make one run of an
    arena differ from the next (§7.4).
12. **Give 122 role-less mutts a role** (§10.1).
13. **Fill `targetPreference` and `riskCurve`** on the archetypes currently
    carrying the null value — 6 and 8 of 15 (§8.2).
14. **Surface the arena's interior and the run-shaping layer** (§2.1, §2.2, §9.4):
    zone features in `ZoneDossier`, `structuralFatigue` as a gauge, the weather
    front as an indicator, the temperament and cast shape on the briefing.

### Fifth — the design work

15. **Arena laws that add rather than subtract** (§5.2).
16. **Group-level objectives** (§3.4, §4.5).
17. **A campaign layer that lets district legacy move between runs** (§9.4).
18. **Surnames, a third name pool, and more mentors** (§11.5, §11.6).

---

## Closing note

The first audit found a game with systems that did not work. This one finds a
game with systems that work and do not happen. Every number in this report came
out of the repository's own tooling or out of five short probes written against
its own public simulator API — the fact that both were possible in an afternoon
is itself the strongest thing that can be said about the state of the codebase.

The check roster is excellent at "does this run without violating an invariant"
and has no vocabulary for "does this ever occur". Nine of the findings above are
the same finding: a threshold set above the range the simulation produces, shipped
green, and invisible because nothing counted it. The cheapest durable fix is not
any one of them — it is a convention that every new mechanic lands with a soak
counter, and that a counter reading zero fails the build the same way a violated
invariant does.
