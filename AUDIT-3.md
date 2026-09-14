# Survival Games — third full audit (11 sections)

## Context

Taken against `main` at `375d233`, after `AUDIT.md`, `AUDIT-2.md` and the two
fix passes recorded in `CHANGELOG.md`. It is written to the eleven headings the
request named, and **nothing below is merged into a neighbouring section** —
where a finding is relevant twice, it is stated twice, in its own terms.

Everything numeric here was measured on this commit, either by the repository's
own check roster or by four throwaway probes written against `Simulator`'s
public API and deleted afterwards. Where this report says "never happens", it
means a counter that stayed at zero across a stated number of complete runs.

### The check roster, on this commit

| check | result |
|---|---|
| `lint` | clean |
| `test:sim` (400 runs) | passes, no invariant violations |
| `test:metrics` (400 runs) | 23/23 regression guards hold; 1 short of design goal |
| `test:decisions` (40 runs, 5,692 tribute-cycles) | passes |
| `test:achievements` (200 runs) | passes; **17** entries never unlock, 7 rarity labels drifted |
| `test:arenas` | passes, 40 authored arenas + 12 procedural biomes |
| `test:flavor` | passes; 0 pools under floor, 0 under target |
| `test:knobs` | 2,066 knobs across 128 groups, all referenced |
| `test:undeclared-knobs` | no new drift; 87 baselined sites remain |
| `test:names` | 3,200 names + 124 mentors; 191 names in two pools |
| `test:predicates` | clean |
| `test:zone-features` | 415/415 zones author an interior |
| `test:storage` | 15/15 migration cases pass |
| `test:arena-layout` | 52 layouts, no collisions, 46px touch targets |
| `test:ui` | 46/46 Playwright steps, no console or page errors |

The roster is in excellent health and the previous two audits' headline findings
are genuinely fixed — alliance teardown ordering, the suspicion axis, earned
traits, unreachable achievements, archetype nulls. **Nothing in §1 below is a
crash.** The failures found this time are of three kinds, in descending order of
importance:

1. **Taxonomies with dead members.** Five separate enums declare a kind the
   engine can never produce: `Trap.kind = 'stake'`, `RumourKind = 'restock'` and
   `'cache'` as *true* rumours, and others in §6. Each was designed, typed,
   documented in a comment, wired into its read sites, and then never
   constructed. These are cheap and they are the same bug five times.
2. **Content with no identity.** 1,123 of the 1,323 authored arena events carry
   no `id`. Nothing can count them, dedupe them, gate them `oncePerRun`, or
   assert that any one of them has ever fired. This is the single largest
   observability hole left in the repository and it silently caps §5, §7 and §10.
3. **Guards that exclude their own outliers.** The archetype spread guard reads
   1.63x because it only counts archetypes with n ≥ 500. The true spread across
   all fifteen is **3.33x** (survivalist 7.20%, zealot 2.16%). §8.

### The probes

Four scripts were written against `Simulator`, run, and removed:

- **A** — 120 complete runs, end-state census of every tribute: cause of death,
  zone memory, traits, inventory, scars, infection, debts.
- **B** — 100 complete runs sampled **every cycle** (1,641 state-samples,
  12,083 tribute-cycles): alliances, pacts, charters, roles, objectives,
  stances, truces, laws, temperaments, quells, epithets.
- **C** — 132 complete runs, per-run census of mutts seen, wildcards fired,
  zone effects, traps, feast themes, rumour kinds, bloc treaties.
- **D/E** — 60 complete runs each on four fixed arenas, matching authored event
  templates against the run's own log by literal-text signature, to measure how
  often each authored event actually reaches the player.

A note on probe B: an end-state census is the wrong instrument for anything that
lives and dies inside the run. Probe A read `state.alliances` at the end of a
run and reported **five alliances across 120 runs**, which is nonsense — the
last tribute standing has no allies. Every social number in this report comes
from per-cycle sampling for that reason.

---

## §1 — All bugs

Ordered by consequence. None of these is a crash; the check roster is green and
stays green with all of them present, which is the point.

### 1.1 Two mutts share an id (`crevasse-worms`)

`src/data/mutts.ts:755` and `src/data/mutts.ts:1199` both declare
`id: 'crevasse-worms', name: 'Crevasse Worms'` in different arena rosters, with
different stat blocks. `CHANGELOG.md` notes this was *spotted* in the last pass
("note that two share an id") and it was never fixed.

Consequence: `state.muttsSeen` is a `string[]` of ids, so the two are one entry.
Any achievement, dossier row or bestiary count keyed on mutt id collapses them,
and whichever of the two is encountered second is recorded as a repeat of the
first. Measured: 196 authored mutts, **195 distinguishable ids**.

There is a second, softer collision: `Ash Wraiths` appears twice under distinct
ids. That one is only a display duplicate — two arenas can legitimately field a
thing by the same name — but it will read as a content bug to a player who sees
both in a Hall of Fame bestiary.

**Fix**: rename one id. Add `test:arenas` assertion that mutt ids are unique
(and that names are unique, or deliberately baselined).

### 1.2 `Trap.kind = 'stake'` can never be built

`src/models/types.ts:1429` declares five trap kinds and the doc comment above it
describes the fifth at length: *"a poisoned stake is what a tribute with a venom
gland and no intention of fighting builds."* `src/engine/fieldcraft.ts:100-103`
is the only construction site and its ternary chain produces exactly four:
`tripwire`, `snare`, `pit`, `deadfall`. Every downstream read site
(`fieldcraft.ts:248, 265, 312, 318`) therefore has a fall-through branch that no
input reaches.

Measured over 132 runs: pit 137, deadfall 205, snare 4, tripwire 1, **stake 0**.

Note the second half of that measurement, which is its own finding: `snare` and
`tripwire` both require `materialIdx >= 0` (cordage in inventory) and `tripwire`
additionally requires an evasive stance, so between them they account for **5 of
347 traps**. The trap system in practice is a two-item menu with three items
written.

### 1.3 Half the rumour taxonomy can never be true

`src/engine/rumours.ts:33` declares `RumourKind = 'restock' | 'holed-up' |
'cache' | 'empty'`, and `rumourPull` (line 82) gives `restock` and `cache` a
*different, stronger* lure weight than the other two — they are the two kinds
designed to pull a tribute toward a place rather than away from it.

`mintTrueRumours` (line 93) builds its candidate list from exactly two sources:
an armed, stationary tribute (`holed-up`) and a genuinely stripped zone
(`empty`). There is no branch that ever mints a true `restock` or a true
`cache`.

Consequence: the two highest-pull rumour kinds exist **only as lies**, minted by
`plantRumour`. A tribute who hears "the horn restocked" is, by construction,
always being played. Measured over 132 runs: holed-up 57, empty 27, cache 1
(planted), restock 0. The design — "a proposition with a subject", where the
interesting question is whether it is true — collapses to "two kinds are always
true, two kinds are always false", which a sufficiently observant player learns
once and then never has to think about again.

**Fix**: mint `restock` when `cornucopiaRestocks` actually fires (the soak
already counts 147 of them per 400 runs) and `cache` when an alliance's
`sharedCache` or an `abandonedCamps` entry is genuinely sitting in a zone. Both
states already exist on `GameState`.

### 1.4 `firedEvents` cannot see 85% of the events it exists to track

`GameState.firedEvents?: string[]` and `eventLastFired?: Record<string, number>`
are the dedupe and cooldown mechanism for arena events. They key on
`ArenaEventDef.id`. Of the 1,323 authored arena events in `ARENA_FLAVOR`, **200
carry an `id` and 1,123 do not.**

Consequences, all of them silent:

- `oncePerRun` is unenforceable on an event with no id. Only the 200
  id-bearing events (the `EXTRA_ARENA_EVENTS_GROUP*` packs) can be
  once-per-run; the 1,123 in the main table can repeat within a run.
- No cooldown applies to them, so the same set piece can land twice in three
  cycles.
- **No check can assert that any of them ever fires.** `test:flavor` counts pool
  depth; it cannot count reach. This is exactly the failure mode `AUDIT-2`
  identified as the codebase's structural blind spot, and it is still wide open
  across the largest content table in the repository.

This one is not itself a visible defect — probe E confirmed by text-matching
that the unidentified events *do* fire, at a median of 8–11 appearances per 60
runs per arena, with 0–3 of 33 never appearing per arena. But it means that
statement required a throwaway script to make, and cannot be made by CI.

**Fix**: generate ids from the arena id plus a slug of the text, once, as a
codemod; then add the `test:flavor` assertion that every authored event fires at
least once across the sweep.

### 1.5 The archetype balance guard excludes its own outliers

`scripts/metrics.ts` reports `archetype win-rate spread (best/worst) 1.63x` and
`worst archetype win rate 4.40%`, both PASS, both meeting their design goal.
Immediately below, the same script prints:

```
  survivalist    778   7.20%
  ...
  saboteur       271   2.21%
  zealot         278   2.16%
```

and a note explaining that eight archetypes drew fewer than 500 entrants and are
therefore "reported above, but not guarded". The guarded spread is computed over
the seven archetypes with n ≥ 500. **The real spread is 7.20 / 2.16 = 3.33x**,
against a design goal of ≤ 2.3x, and the real worst is 2.16% against a goal of
≥ 3.5%.

The exclusion is defensible as written — at n=278 one victor moves zealot by
0.36 points — but the consequence is that the two archetypes that are actually
out of band are the two the guard is structurally unable to see, and the report
reads PASS/goal-MET on both lines. See §8.2 for the balance reading.

**Fix**: raise `METRICS_RUNS` for the guarded statistic only, or weight the
sample so every archetype reaches n ≥ 500 (the config sweep controls district
count, so an archetype-balanced cast shape is available), or report the
unguarded spread as a separate, explicitly wide-confidence line so it cannot be
read as passing.

### 1.6 Seventeen achievements never unlock, seven rarity labels are wrong

`test:achievements` over 200 runs:

- **Never unlocked (17)**: `the-liar`, `whisper-campaign`, `caught-out`,
  `nobody-is-buying`, `lawyers-of-the-arena`, `no-hard-feelings`,
  `took-the-marked-pack`, `performed-to-the-end`, `fever-dream`, `front-loaded`,
  `reflection-survivor`, `every-door`, `the-quiet-one`, `borrowed-time`,
  `the-unwitnessed`, `every-district-bleeds`, `treaty-year`. Seven of them carry
  no `nearMiss`, so the player never learns they exist.
- `treaty-year` is unreachable **by construction**: probe C measured
  `state.blocTreaties` non-empty in **0 of 132 runs**, despite
  `blocTreatiesSworn` appearing on 335 of 1,641 state-samples in probe B. The
  two fields disagree about whether a treaty happened.
- `performed-to-the-end` was already re-scoped once in the last pass for exactly
  this reason and still does not fire.
- **Rarity labels contradicted by measurement (7)**: `never-touched-a-body`,
  `unmarked`, `clean-getaway` (all labelled common, measured 29.5%),
  `bloodless-crown` (common, 24.5%), `nightlock-ending` (uncommon, 7.5%),
  `both-mourned` (uncommon, 6.0%), `the-executioner` (legendary, 3.5%).

The labels were regenerated from a 600-run measurement in the last pass and have
drifted again in one release. That is a process finding, not a data finding: the
labels should be derived at build time from the measured rate, not stored.

### 1.7 Four `role="dialog"` surfaces with no focus management

`useDialogFocus` exists (`src/ui/useDialogFocus.ts`) and is used by
`SettingsPanel`, `TributeCompare` and `GameScreen`. Of the seven `role="dialog"`
surfaces:

- `TributeModal.tsx:237-260` hand-rolls its own focus trap and focus restore —
  ~25 lines duplicating the hook, and now the canonical behaviour lives in two
  places that can drift.
- `CommandPalette.tsx` sets `aria-modal="true"` (line 182) but only focuses its
  input (line 60). Tab escapes the dialog into the page behind it, and focus is
  not restored on close. `aria-modal` asserts a containment the component does
  not implement.
- `Explainer.tsx` and `PlaybackPopover.tsx` handle Escape but never return focus
  to the trigger.

### 1.8 `assignRoles` assigns four roles to a two-person alliance

`src/engine/alliance.ts:144`. The doc comment states this is intentional ("One
member may hold more than one role in a pair"), and as a rule it is defensible.
As a measurement it is not: probe B recorded `quartermaster`, `scout`, `muscle`
and `medic` at **exactly 1,748 samples each** across 1,848 alliance-samples, of
which **847 (46%) were pairs**. In nearly half of all alliance-samples the role
assignment carries no information at all — two people, four hats, and the same
person is frequently the muscle and the medic.

This is a bug in the sense that a downstream read ("kill the quartermaster to
break the group") is a no-op in a pair, while the log line at line 259 announces
the arrangement as though it meant something. See §4.3.

### 1.9 Minor and cosmetic

- **`Trapwise` holds 7 entrants across 120 runs with a 0% win rate.** It was
  fixed last pass (from never granted to granted); it is now granted so rarely
  that it cannot be balanced or observed. Not the same bug, but the same trait.
- **`itemQualities` reads `undefined` on 583 of 1,513 sampled inventory items.**
  `Item.quality` is `'crude' | 'standard' | 'fine'` and is optional; 38% of
  items in the field carry no quality at all. Whether that is "unqualified
  consumables" or an unset field on weapons is worth one grep — the dossier and
  the compare view both render quality.
- **`state.victorIds` was populated on 2 of 1,641 state-samples** (the dual
  victories). Single-victor runs never write it. Any consumer that reads
  `victorIds` rather than "the one alive tribute" is reading an empty field 99%
  of the time.
- **`loveTriangles` fired in 1 of 132 runs.** `src/engine/triangles.ts` is 
  a system that effectively does not exist at the measured rate.

---

## §2 — All QOL, UI and UX updates needed

The UI is genuinely strong: 46 Playwright steps, a command palette, deep
linking, replay, spoiler-safe viewing, three category palettes including a
colourblind-safe one, dark mode, imperial/metric, reduced-motion honoured in the
feed and in CSS, a 46px minimum touch target on the arena graph verified at
460px, and no horizontal overflow at 380px. What follows is the gap list, not a
rewrite.

### 2.1 141 `title=` attributes are the only home for their hint text

Counted across `src/components` and `src/screens`: 141 `title=` usages, with
`DossierPanel` (32), `TributeModal` (29), `RosterScreen` (11) and
`BroadcastBar` (10) the worst offenders. `SettingsPanel` puts the *explanation
of what a setting does* in `title` (lines 57, 87).

A native tooltip appears on mouse hover only. It does not appear on touch, it
does not appear on keyboard focus, it is not announced by most screen readers
when the element has its own accessible name, and it cannot be styled or read at
leisure. On a phone — a platform this app explicitly supports and tests — every
one of those 141 hints is invisible.

**Fix**: one `<Hint>` primitive that renders `aria-describedby` text, shows on
hover *and* focus, and is dismissible on touch. `Explainer.tsx` is already 90%
of that component.

### 2.2 Four components carry no `aria-` or `role` at all

`HofCompare.tsx`, `RunProfileCard.tsx`, `VictorArc.tsx`, `ZoneDossier.tsx`.
`VictorArc` and `ZoneDossier` are both data-visualisation surfaces — an arc and
a sector readout — which is the category where an unlabelled DOM is least
recoverable. `BodyDiagram`, `RelationshipGraph` and `TributeTile` carry exactly
one each, which for a body map and a relationship graph is close to none.

### 2.3 The dialog behaviours in §1.7, restated as UX

Tab escaping the command palette is the specific one a keyboard-only player will
hit within a minute: open palette, press Tab, and focus lands somewhere behind
the scrim with the palette still covering it.

### 2.4 `prefers-reduced-motion` is honoured in two places, not globally

`EventFeed.tsx` checks it for the day-jump smooth scroll; `index.css` and
`prefsStore.ts` reference it. The project depends on `motion` (Framer Motion
v12) and nothing in `src/components` gates a `motion.*` animation on the
preference. The feed's new-entry animation, which replays on every advance, is
the one that matters most for a player who set that preference.

### 2.5 The feed's "show earlier entries" is still all-or-nothing

`EventFeed.tsx:620-631` is a careful, well-commented fix to a real bug (the
density filter running after the slice). But `setExpanded(true)` still renders
**the entire run** in one step. At the measured 400-run average of 8.6 days and
a 2,000+ line log, a player who wants the previous page gets every page. A
"show 200 more" that walks the cutoff back by another window is a four-line
change to the same `useMemo`.

### 2.6 Things the player cannot currently see, that the engine knows

Each of these is live state with no surface:

| state | what it decides | where it belongs |
|---|---|---|
| `structuralFatigue` (1,054/1,641 samples) | when zones collapse | a gauge on `ArenaMap` |
| `weatherFront` (570 samples) | the coming hazard | an indicator on `BroadcastBar` |
| `zoneDepletion` (1,518 samples) | whether foraging pays | shading on `ArenaMap` |
| `climateDrift` (820 samples) | the arena's slow turn | the arena briefing |
| `audienceInterest` / `excitementFlatCycles` | when Gamemakers intervene | `BroadcastBar` |
| `truceLedger` (1,011 samples) | who owes whom peace | `RelationshipGraph` |
| `rumours` (63/132 runs) | what tributes wrongly believe | `ZoneDossier` |
| `sponsorBlocBudgets` (1,303 samples) | who can still afford you | the sponsor panel |

`AUDIT-2` raised the first two and the fix pass did not reach them. The
`zoneDepletion` one is the highest value of the eight: the soak measures p50
depletion 0.19 and p90 0.71, so the map has real, legible variation the player
is never shown.

### 2.7 Smaller items

- `ReapingScreen` and `VictorInterviewScreen` have **zero** `useMemo`/
  `useCallback` and one aria attribute each; they are the two screens a player
  sees first and last.
- 4 `onClick` handlers on `<div>` elements — keyboard-unreachable by default.
- The settings "reset" buttons (lines 171, 178) explain their scope only in
  `title`, so on touch two identically-styled reset buttons are
  indistinguishable.
- The chronicle's day-jump rail appears only at `days.length > 2`, which on a
  short run (the soak's two-district configs end in 7 days, some faster) means
  the control the tutorial mentions is sometimes absent.

---

## §3 — Tribute logic: updates, robustness and more complexity

### 3.1 Where the tribute model is now

It is deep, and the depth is real rather than decorative: graded injuries per
site (`injurySeverity` 0-3), per-site infection with an incubation clock
(`woundInfection` + `woundAge`), handedness interacting with `woundedSide`,
`frame`/`condition` with signed `conditionPressure`, `sleepDebt` distinct from
fatigue, `resolve` distinct from `sanity`, `momentum` and `rattled` as symmetric
short-lived states, per-item `weaponFamiliarity` on top of bucket
`proficiencies`, `attributeDrift` on all six attributes, `scars`, `traitAge`
driving trait decay and evolution chains, and a two-deep `objectiveQueue`.

`test:decisions` reports the decision layer choosing the best-scoring stance
56.3% of the time and the best destination 65.0%, with only 1.2% of destinations
in the bottom fifth of their own scoring. That is the correct shape — tributes
who always pick optimally are not people.

### 3.2 Map coverage improved, and is still the ceiling on everything

`AUDIT-2` measured a median of two zones visited. Probe A measures a **median of
4 zones and a maximum of 12**, against arenas of 10–13 zones. That is real
progress (the `wait`/ambush and objective work moved it) and it is still the
single number that caps §5, §7 and §10: a player who has paid for 415 authored
zone interiors sees a third of one arena's worth per run.

The honest framing, which `AUDIT-2` arrived at and then withdrew a fix for, is
that this is **not** a movement-tuning problem. The median tribute dies on day
three. Four zones in three days is a reasonable rate of travel; the arena is
simply larger than a lifespan. The two real levers are:

- **Make zones plural per visit.** A zone with `ZoneFeatures` has an interior
  the tribute currently consumes in one cycle. A "sub-location" pass — the
  boathouse *inside* the lakeside, entered on a second cycle in the same
  zone — multiplies content per zone visited without asking anyone to walk
  further. `test:zone-features` reports 415 zones authoring interiors with
  165/334/261 in the three feature columns; the material is there.
- **Make the victor's tour the reward.** The victor covers 40% of the map at the
  median. An epilogue beat that walks the crowned victor back through the zones
  they *never* saw — as a Capitol retrospective — spends the unvisited content
  without changing movement at all.

### 3.3 The objective distribution is top-heavy

Probe B, 12,083 tribute-cycles:

```
hunt     30.4%   reach    30.1%   survive  15.9%   protect   9.2%
flee      8.5%   hold      3.1%   stalk     1.8%   wait      0.9%
```

`wait` was raised from 0.0% to 1.1% last pass and now measures 0.9%; `stalk` at
1.8% and `hold` at 3.1% are in the same band. Three of the eight objective kinds
account for 5.8% of all decisions between them. Either they need a real gate
that fires (each is a distinct set of log lines and tension beats that almost
nobody sees) or the taxonomy should admit it has five members.

`objectiveTension` is present on 19.4% of tribute-cycles and `objectiveQueue` on
7.4% — the tension layer is genuinely reaching people; the queue is thin.

### 3.4 Robustness: the specific fragilities

- **Eleven unguarded `/ length` divisions** in the engine (`combat.ts:381`,
  `items.ts:138`, `objectives.ts:171`, `gamemakerAgency.ts:326`,
  `sideMarkets.ts:261, 289` among them). Several are guarded by the caller, but
  `combat.ts:381` divides by `mates.length` and `items.ts:138` by `worn.length`
  with no visible guard at the site. A zero-length array there is `NaN`
  propagating into a relationship score or a damage split — which would not
  crash, would not violate any soak invariant, and would silently produce a
  tribute whose numbers stop meaning anything.
- **No `Math.random` or `Date.now` anywhere in `src/engine` or `src/data`.**
  Determinism discipline is exemplary; that is worth stating.
- Only 15 non-null assertions across the whole engine. Also good.

### 3.5 Where the tribute could be more complex

Ordered by payoff per line:

1. **Deception as a first-class state.** `displayedRegard` (present on 111
   tribute-samples) is the one existing piece. There is no analogue for a
   *performed* stance, a *performed* injury (limping to draw an attack), or a
   performed inventory (visibly carrying a fake weapon). `visiblePower` already
   exists and already reads `favouring`; a `feigning` field would plug straight
   into it.
2. **Handedness is nearly free complexity, half-spent.** `woundedSide` is
   written on 349 tribute-samples and `handedness` is fixed at the reaping, but
   nothing lets a tribute *train* the off hand, and nothing makes a left-handed
   opponent a different fight (the canonical reason handedness matters).
3. **`sleepDebt` has no payoff beat.** It accrues; nothing dramatises the
   moment it comes due. A microsleep — a tribute who loses a cycle standing up,
   in a zone with somebody else in it — is one function.
4. **Attribute drift has no visible arc.** `attributeDrift` moves all six
   attributes, and the epilogue does not tell the player who they became. "She
   walked in the weakest in the field and walked out stronger than four
   Careers" is the story the data already contains.
5. **`terminalInfectionBeaten` appears on 10 tribute-samples in 12,083.** The
   single most dramatic survival beat in the model is a 0.08% event.

---

## §4 — Tribute relationships and alliances: improvements and updates

### 4.1 What is working, measured

Probe B (100 runs, per-cycle) and `test:metrics` (400 runs) agree:

```
alliance size distribution (samples)   2: 847   3: 409   4: 323   5: 197   6: 63   7: 2   8: 6
alliance samples of 3 or more          53.2%  (guard >= 30%)
organic groups of 3+ per run           4.10
betrayals per run                      5.06
vengeance sworn per run                10.35
runs with star-crossed lovers          14.2%, avg day 5.0
alliances given a broadcast name       1,848 samples
named successors                       930 samples
night watches posted                   1,273 samples
expulsions                             131
factions formed inside alliances       502 samples
```

This is a healthy, busy social layer. The last pass's suspicion recalibration
clearly landed.

### 4.2 The pact distribution is half "no pact"

```
no-pact 828   until-field 422   to-the-end 264   until-event 141
until-day 111   until-goal 82
```

`AlliancePact` is a six-member union whose most common member is the null one,
at 46%. `rollPact` was rewritten last pass specifically to stop small fields
dissolving instantly — that worked — but the result is that the modal alliance
is one that agreed nothing, and therefore has no scheduled ending to dread. The
telegraphed betrayal the design document calls "one of the best things the
alliance layer can produce" is available to 54% of alliances.

`until-goal` at 82 samples and `until-day` at 111 are the two most interesting
kinds and the two rarest.

### 4.3 Roles are assigned uniformly and mean nothing in a pair

Restating §1.8 as design: 1,748 samples of each of the four roles, across 1,848
alliances, 46% of which are pairs. The roles are a flat, always-on, always-
complete assignment. Suggestions, cheapest first:

- **Scale the role set to the group.** A pair gets one role (who holds the
  supplies) or none. A group of five gets all four plus a fifth worth inventing.
- **Give each role a mechanical consequence the group notices when it is
  removed.** The quartermaster is described as "the obvious knife target" —
  make killing them actually scatter the cache, so the description is a
  strategy rather than a caption.
- **Let roles be contested.** `leaderStyle` (democratic 1,498 / tyrant 350)
  already distinguishes how a leader rules; nothing lets a member want a role
  they were not given.

### 4.4 The charter is the best-balanced subsystem in the game

```
no-hunting-alone 451   hold-the-camp 383   leader-decides-targets 368
share-intel 350        split-at-eight 349   share-food 339
no-fighting 324        no-looting-the-fallen 251
```

Eight rules, all in a 251–451 band. This is what §3.3 and §4.2 should look like.
It is worth saying out loud so the pattern that produced it can be copied: the
charter rules are drawn from a flat pool with light eligibility gating, and
every one of them has a breach condition that a normal run actually produces.

### 4.5 Truces work; the truce *ledger* has no reader

`truceReason` distribution over 12,083 tribute-cycles, with a truce live on
10.8% of them:

```
mutual-threat 550   extortion 405   brokered 368   both-wounded 276
```

Four reasons, well spread, exactly as `AUDIT-1`'s fix intended. `truceLedger`
is populated on 1,011 of 1,641 state-samples, the soak asserts it balances
exactly, and **the player is never shown it** (§2.6). A standing-peace overlay on
the relationship graph is the whole feature.

### 4.6 Loans are the thinnest relationship primitive

`loans` — the "you lent them your spare knife on Tuesday" grievance — is live on
**2.2% of tribute-cycles**, against `debts` (the heavy version) at 529
tribute-samples. The type comment argues, correctly, that the model needed
something below a life-debt. What shipped sits so far below it that it is closer
to absent than to light. Either an ally who is short a weapon should borrow one
as a matter of course, or the primitive should be folded into `debts` at a low
weight.

### 4.7 Bloc treaties are broken or unreachable

`blocTreatiesSworn` appears on 335 of 1,641 state-samples; `blocTreaties` was
non-empty in **0 of 132 runs**. Two fields that describe the same event disagree
completely. This is why the `treaty-year` achievement (§1.6) never unlocks and
carries no near-miss. Worth one afternoon: either the treaties are being sworn
and immediately discarded, or the counter increments where the array does not.

### 4.8 Where the social layer could go deeper

1. **Group-level objectives.** Raised in `AUDIT-2` §3.4/§4.5 and not taken up.
   Every objective in the model belongs to an individual; an alliance has a
   camp, a cache, a charter, roles and a name, and **no shared goal**. "Hold the
   horn until the feast" as an alliance-level objective would give the roles
   something to do, the charter something to be broken over, and the pact
   something to expire against.
2. **Reconciliation.** The model has betrayal, expulsion, grief, vengeance,
   suspicion and hearings. It has no path from an expelled member back in, and
   `expelledIds` exists specifically to prevent one. A tribute who was thrown
   out on day two and is needed on day eight is a scene the model cannot stage.
3. **Asymmetric knowledge of the bond.** `displayedRegard` lets A perform
   affection at B. Nothing lets B *suspect* the performance without knowing —
   which is the actual Star-Crossed dynamic.
4. **Grief with a direction.** `sharedGriefPending` (1,434 samples) and
   `sharedGriefAllies` (55 samples) differ by 26x. The shared version — two
   people mourning the same third — is the rarer and better beat.

---

## §5 — Arena: updates, robustness and more complexity

### 5.1 What exists

40 hand-authored arenas, 12 procedural biomes with their own event and ambient
tables, 415 zones every one of which authors an interior, 52 verified layouts,
15 arena laws that stack (`test:arenas` plays 9 stacked-law combinations to
completion), `EdgeRule` traversal rules, `SignatureRule`, `effectVocab`,
`upper`/`lower` zone levels, `structuralFatigue`, `collapsedZones`,
`severedEdges`, `climateDrift`, `weatherFront`, `zoneDepletion` with recovery,
and a `zoneTraffic` model.

This is the strongest part of the codebase.

### 5.2 Law distribution and the subtraction problem

Probe B, 1,641 state-samples:

```
noWaterExceptZone 220   noCannons 186   openMic 159   (none) 155
oneWayBorders 153       sponsorsFixedZone 131   cornucopiaRefills 100
deadlyNight 98          fireImpossible 96   noHealing 70   noForage 69
noSponsors 64           noWeapons 58   shrinkingArena 45   noNight 37
```

Good spread; nothing is dead. The design finding `AUDIT-2` raised is unchanged
and worth restating because it is the arena layer's biggest single opportunity:
**eleven of the fifteen laws are subtractions.** No cannons, no night, no water,
no fire, no sponsors, no healing, no forage, no weapons. Three (`openMic`,
`cornucopiaRefills`, `oneWayBorders`) add or redirect; one (`shrinkingArena`)
compresses.

A law that *gives* — "every dawn, one zone's cache is restocked and announced",
"the arena heals anyone who sleeps in the Cornucopia", "a zone marked each night
pays double forage to whoever holds it at dawn" — changes what players *do*
rather than what they *cannot* do, and creates contested ground rather than
scarcity. `cornucopiaRefills` at 100 samples is the existing proof this works.

### 5.3 Zone effects: ten kinds, a 34x spread

```
fogbound 711   flooded 333   burning 305   stripped 271   contaminated 236
frozen 140     quaking 57    swarming 56   blooming 33    irradiated 21
```

`fogbound` alone is 34% of all zone-effect samples and 34x `irradiated`.
`blooming` — the one *positive* effect in the list — is third-rarest at 33.
That ratio is the §5.2 finding in miniature: the arena's vocabulary for "this
place got worse" is six times richer than its vocabulary for "this place got
better", and the good one is the rarest.

### 5.4 Feast themes: four, and one of them is 40% of all feasts

```
food 4   weapons 3   district-gifts 2   medical 1
```

(Small n — 10 themed feasts in 132 runs where a feast convened — but the pool is
literally four entries: `feast.ts:41`.) The feast is the single most anticipated
scheduled event in the format and it has four flavours. Candidates that need no
new mechanics: a **token feast** (each tribute's district token, and nothing
else), a **named feast** (every pack is labelled with a tribute's name and only
they can open it — already supported by `feastPrizes`), a **one-bag feast**
(a single pack), an **empty feast** (the Gamemakers lied — `audienceInterest`
already tracks when they would want to), and a **trade feast** (the pack you can
take is somebody else's supplies).

### 5.5 Procedural arena robustness

`test:arenas` flags three zone-count overshoots as notes rather than failures:
`procedural-tundra` rolled 14 zones, `procedural-archipelago` 16, and
`procedural-ruinlands` 16, against a `check-arena-layout` that is "tuned to 13".
That means three of twelve biomes can generate a map the layout checker does not
verify. Not a crash — the layouts are probably fine — but it is an assertion
that quietly stops applying to a quarter of procedural output.

### 5.6 Where the arena could be more complex

1. **Zone sub-locations** (see §3.2) — the highest-value arena change available,
   because it spends content already written.
2. **Laws that change mid-run.** Every law is fixed at generation. A law
   announced on day four ("from tonight, the Cornucopia is the only water")
   turns the whole field at once; `arenaSignature.ts` already has the
   vocabulary for arena-wide announcements (its THE SHIFTING line is exactly
   this, for one arena).
3. **Zones that remember.** `zoneDeaths` and `recentCannonZones` are tracked on
   every state-sample. Nothing makes a zone where four people died *read*
   differently — as smell, as flies, as ground nobody will camp on.
4. **Vertical traversal as risk.** `ZoneLevel` is `'upper' | 'lower'` and
   `transit` is live on 10.8% of tribute-cycles. A climb that can be *failed*,
   not merely slow, is the obvious complexity the two fields already imply.
5. **The border as a place.** 73 of 7,200 deaths (1.0%) are border deaths, and
   `borderTelegraphs` fires 97 times per 400 runs. The border is currently a
   wall; `oneWayBorders` proves the code can make it a current.

---

## §6 — Small and side features: updates, robustness and complexity

The repository has an unusual number of small systems. Measured reach, per 132
runs (probe C) unless noted:

| system | reach | verdict |
|---|---|---|
| Gamemaker agency / signatures | 118/132 runs | healthy |
| Zone collapse | 104/132 runs | healthy |
| Intel trades (side markets) | 89/132 runs | healthy |
| Rumours | 63/132 runs | healthy, but see §1.3 |
| Severed edges | 57/132 runs | healthy |
| Bounties | 37/132 runs | healthy |
| Camps / abandoned camps | 1,305 / 416 samples | healthy |
| Sponsor bloc budgets | 1,303 samples | healthy, invisible (§2.6) |
| Wildcards | 5 distinct fired, 263 firings | see below |
| Traps live at run end | 8/132 runs | see §1.2 |
| Love triangles | **1/132 runs** | effectively absent |
| Bloc treaties | **0/132 runs** | broken (§4.7) |
| Legendary items | **0 observed in inventories** | see below |

### 6.1 Wildcards: five in rotation

`firedWildcards` recorded only five distinct wildcard indices across 132 runs
(`1` ×103, `2` ×74, `0` ×43, `3` ×39, `4` ×4). Index 4 fired four times in 132
runs; if the table is longer than five, everything past index 4 is unreached.
`extraWildcardsFired` appears on 60 of 1,641 samples, so the second-wildcard
path works. This is the one "run-shaping" system with a visibly short menu, and
it is the system whose whole purpose is to make two runs differ.

### 6.2 Legendary items were never observed

`src/engine/legendaryItems.ts` exports `bloodOnTheBlade` and `namedWeapons`, and
`LEGENDARY_ITEM_NAMES` (16 entries) and `LEGENDARY_ITEM_TEXTS` (12 entries)
exist in `flavorText.ts`. Probe B sampled every living tribute's inventory every
cycle across 100 runs and found **no item flagged legendary**. Two readings are
possible and both need checking: either the flag lives under a field name the
probe did not guess, or a weapon that earns a name never actually gets one. 28
authored flavour lines are riding on the answer.

### 6.3 Quells and temperaments are in good shape

```
temperaments: standard 326  attrition 268  lean 244  blitz 160  treacherous 153
              compressed 134  hostile 132  merciful 126  lavish 98
quells:       volunteers 35  feast 34  cornucopia-forfeit 33  the-reflection 21
              thirst 19  the-elders 19  blood-debt 11  endless-day 7
```

Nine temperaments and eight Quells, all reached, reasonably spread. This is the
replayability layer working (§9).

### 6.4 Smaller notes

- `mossDimUntilCycle` (11 samples), `sealedHornUntilCycle` (14),
  `edgeCrossings` (25), `garrisonedEdges` (38) are each live on under 2.5% of
  state-samples. Each is one mechanic; collectively they are a tail of features
  a player will not meet in ten runs.
- `fullKitSeen` (32 tribute-samples), `poisonedByWeapon` (50),
  `trapsDisarmed` (46), `intelSold` (87), `trucesBrokeredHeld` (96) are the
  rarest tribute-level counters. Several back achievements.
- `sanityRecovered` at 79 tribute-samples in 12,083 means recovery from a sanity
  break is a 0.65% event; sanity is the largest log category in the game
  (16,396 lines across 120 runs) and is effectively one-directional.

---

## §7 — More ways to die, and more events

### 7.1 Where deaths currently come from

`test:metrics`, 400 runs, 7,200 deaths:

```
tribute       55.6%   arena/hazard  11.3%   bleeding    6.3%   dehydration  6.2%
poison         4.9%   frostbite      4.2%   burns       3.3%   mutts        3.3%
infection      2.6%   starvation     1.3%   border      1.0%
```

Probe A recorded **1,104 distinct cause-of-death strings across 2,160 deaths**,
998 of which appeared once or twice. The obituary layer is exceptionally rich —
most causes are "Killed by {name} ({weapon})", but the environmental tail
includes arena-specific strings like *"Crushed as Number 14 closed"* and *"Torn
apart by Wind-Throat Owls"*.

So the deficiency is not variety of *text*. It is variety of *mechanism*:
eleven mechanisms, of which one is 55.6% and the bottom four are 8.2% combined.

### 7.2 Universal ways to die that the model already has the state for

Each of these needs no new field:

1. **Drowning** — `Terrain = 'water'`, `transit`, `Swimmer`/`Waterborn` traits,
   and `flooded` zone effects all exist. There is no drowning death.
2. **Falling** — `ZoneLevel` upper/lower and `Climber` exist. A failed climb
   kills nobody.
3. **Exposure while asleep** — `sleepDebt` and `watch` exist. Dying in your
   sleep, having posted no watch, is the most canonical death in the format.
4. **Septic shock as a distinct end** — `septicCycles` (129 tribute-samples) and
   `terminalInfectionBeaten` (10) exist. Infection at 2.6% has one exit.
5. **Crush / collapse** — `collapsedZones` fires in 104/132 runs and
   `collapsesSurvived` is written on 341 tribute-samples. People survive
   collapses; the death branch is much rarer than the survival branch.
6. **Your own trap** — `trapsSet` on 1,157 tribute-samples, `trapKills` on 90.
   Walking into your own snare is free drama and one equality check.
7. **Bleeding out from a wound you dressed badly** — `woundAge` exists.
8. **Killed by a tribute you had a truce with, during the truce** — the
   `truceLedger` closes exactly; a *broken* truce death is a distinct cause
   string the ledger can already identify.
9. **Starvation-driven collapse in combat** — `conditionPressure` and
   `Condition: 'Wasted'` exist; a wasted tribute losing a fight they would have
   won is a different death from starving alone.
10. **Poisoned by your own weapon** — `poisonedByWeapon` is written on 50
    tribute-samples and never kills its wielder.

### 7.3 Arena-specific deaths, and why there should be more

The `EXTRA_ARENA_EVENTS_GROUP*` packs each author "two signature deaths with a
cause string nobody else's arena can record". That is **80 signature deaths
across 40 arenas** — two per arena. Probe E confirms they reach the player
(`clockwork-two-hours-at-once` fired in 8 of 60 clockwork runs).

Two per arena is the floor, not the ceiling, and the marginal cost is one
`ArenaEventDef`. Concretely, per arena group:

- **Frozen / glacier / floe / cabin / kelvin** — crevasse; whiteout separation;
  the lake closing over you; carbon monoxide in a sealed shelter.
- **Magmatube / burnscar / craterfield / ashfall / ashwaste** — gas pocket;
  the ground giving way onto heat; ash inhalation; the fire that comes back.
- **Clockwork / vault / concrete / labyrinth / warren** — the mechanism you
  stopped restarting; a door that seals; being counted wrong.
- **Reef / islands / seapeaks / saltflats** — tide; salt poisoning; the thing
  under the water; sunstroke on white ground.
- **Menagerie / silkwood / sporefields / canopyweb / storywood** — the
  exhibit; the web; the bloom you breathed; the story that was true.

### 7.4 More events, universal

The generic pools are the thinnest content in the repository. `flavorText.ts`
top-level arrays: **22 arrays, 369 lines total**, with twelve pools at 12–18
entries:

```
DYNAMIC_AMBIENT_TEXTS 12   LEGENDARY_ITEM_TEXTS 12   MENTOR_POINTED_TEXTS 12
MENTOR_WITHHELD_TEXTS 12   INTERVIEW_SCENARIOS 13    BETRAYAL_WITNESS_TEXTS 14
GRIEF_TEXTS 15             TRAINING_MINGLE 15        BETRAYAL_AFTERMATH_TEXTS 16
LEGENDARY_ITEM_NAMES 16    INTIMIDATION_TEXTS 18     MENTOR_PARACHUTE_TEXTS 18
```

`test:flavor` reports "0 pools under the target of 12", which means the target is
12 and everything is at or just above it. Against 14,774 lines of arena flavour,
**15 grief lines** is the imbalance to fix: grief fires on every ally death in a
game averaging 18 deaths per run, so a player sees the whole grief pool in a
single run and every run after that is a repeat.

Priority order by exposure: `GRIEF_TEXTS`, `BETRAYAL_WITNESS_TEXTS` and
`BETRAYAL_AFTERMATH_TEXTS` (5.06 betrayals/run), `DYNAMIC_AMBIENT_TEXTS`,
`INTIMIDATION_TEXTS`, then the four mentor pools.

Universal event *types* missing entirely, as distinct from lines:

- A tribute finding another tribute's **body** and what they do about it.
- A tribute finding a **camp** whose owner is still alive (416 abandoned-camp
  samples; no "they came back" beat).
- **Weather as an event** rather than a modifier — `weatherFront` exists.
- A **sponsor gift that arrives for someone who just died**.
- The **anniversary beat**: day 5, day 8 — the Capitol marking time.
- A tribute **talking to themselves** at low sanity, aimed at the audience.

### 7.5 More events, arena-specific

The per-arena pack is fixed at 33–34 events for all 40 arenas — a uniform depth
that is a good floor and a suspicious ceiling. Reach measurement (probe E, 60
runs per arena) shows the median authored event appearing in 8–11 of 60 runs and
0–3 events per arena never appearing at all, which means the packs are **not**
saturated: adding to them adds visible content rather than diluting.

The `requires` gates are where per-arena variety actually lives, and
`AUDIT-2 §7.4` measured them as barely used (24 uses of
`minSurvivors`/`maxSurvivors` in 1,594; `sanityBand` 12; `trait` 17; `stance`
17; `law` 25). Those numbers are essentially unchanged. An event gated on
`law` is the only mechanism by which an arena's *law* can produce distinct
prose, and 25 of 1,323 events use it.

---

## §8 — Trait and archetype balance audit

### 8.1 The headline numbers

`test:metrics`, 400 runs, 7,200 entrants:

| indicator | measured | guard | goal |
|---|---|---|---|
| archetype win-rate spread (guarded subset) | 1.63x | ≤ 4.6 | ≤ 2.3 MET |
| **archetype win-rate spread (all fifteen)** | **3.33x** | — | ≤ 2.3 **not met** |
| worst archetype (guarded subset) | 4.40% | ≥ 2.0% | ≥ 3.5% MET |
| **worst archetype (all fifteen)** | **2.16%** | — | ≥ 3.5% **not met** |
| reaping-trait win spread | 1.52x | ≤ 4.5 | ≤ 2.5 MET |

The guarded numbers are genuinely good and represent real work. The unguarded
ones are §1.5.

### 8.2 Archetypes, all fifteen

```
  survivalist    778   7.20%   4.32 days   0.41 kills
  career         846   6.26%   4.29        0.93
  wildcard       643   6.22%   3.21        0.66
  beast          191   5.76%   3.08        0.82
  protector      833   5.52%   3.82        0.49
  ghost          324   5.25%   4.23        0.31
  trickster      695   5.18%   3.61        0.65
  strategist     676   5.03%   3.70        0.42
  diplomat       279   4.66%   3.99        0.36
  mercenary      328   4.57%   3.48        0.59
  underdog       863   4.40%   3.69        0.36
  scholar        322   4.04%   3.57        0.28
  medic          273   4.03%   3.99        0.46
  saboteur       271   2.21%   3.80        0.36
  zealot         278   2.16%   2.92        0.43
```

Readings:

- **Ghost was fixed and the fix held.** 2.78% → 5.25% after the `late-blooming`
  risk curve. That was the right diagnosis and the right instrument.
- **Zealot (2.16%) is the new Ghost, and it is a different problem.** Zealot has
  the **shortest survival in the game at 2.92 days** with a middling 0.43 kills.
  It is not losing at the end; it is dying early and not being paid for it. Its
  signature fires on only **38.5% of entrants — dead last of fifteen**. An
  archetype whose set piece reaches fewer than four in ten of its holders is
  half a design.
- **Saboteur (2.21%) is the opposite failure.** 3.80 days — above the field
  median — and 0.36 kills. It survives and does not convert. Its own earned
  trait (`Trapwise`) reaches 7 holders per 120 runs (§1.9), and the trap system
  it exists to exploit builds `snare`/`tripwire` 5 times in 347 (§1.2). The
  Saboteur is the archetype most damaged by a bug in another system.
- **Beast (5.76%, 3.08 days, 0.82 kills)** is the game's most interesting
  outlier: second-shortest life, second-highest kills, above-median win rate. It
  is working exactly as an all-in archetype should. Nothing to do.
- **Scholar and medic (4.04%, 4.03%)** are both "survives fine, wins rarely" —
  the same shape as saboteur, less severe.
- **Signature fire rate spread: survivalist 60.5% vs wildcard 42.5%.** A
  narrower band than the win rates and broadly healthy, but the correlation
  between low fire rate and low win rate (zealot, mercenary, beast excepted) is
  strong enough to be worth treating as a lever: raising a signature's reach is
  a balance change.

### 8.3 Reaping traits: spread is fine, the *signs* are wrong

The 1.52x spread is good. What the guard cannot see is that several pairs are
ordered backwards relative to what they claim to do:

```
  Clumsy         319   6.27%      Nimble          718   5.29%
  Pacifist       441   6.35%      Bloodthirsty    637   5.81%
  Fragile        222   4.50%      Fleet           210   4.29%
  Iron Stomach   380   7.37%      Herbalist       320   4.06%
  Wrestler       212   8.49%      Marksman        250   4.40%
```

`Clumsy` outperforming `Nimble` by a full point, and `Fragile` outperforming
`Fleet`, are the two that read as defects rather than as interesting balance.
The script's own note is the right caveat — trait assignment is correlated with
archetype `preferredTraits` and with District 3's reaping — but that caveat cuts
both ways: if `Clumsy` beats `Nimble` because of *who receives it*, then the
reaping's trait allocation is doing more balance work than the traits are, and
that is worth knowing deliberately rather than as an artefact.

`Wrestler` at 8.49% is the highest reaping trait in the game and 1.93x the
lowest (`Chameleon`, 3.23%) — within guard, at the top of the band.

### 8.4 Trait power levels

```
combat    n=25  mean 0.89  sd 0.92   hot: Hardened 3.45 (2.8sd), Unremarkable 2.92 (2.2sd)
social    n= 6  mean 0.73  sd 0.24   cold: Oathbound 0.35 (-1.6sd)
survival  n=27  mean 0.87  sd 0.62   hot: Waterborn 2.54 (2.7sd), Broken 2.00 (1.8sd)
```

- **The social category has six traits against combat's 25 and survival's 27.**
  That is the clearest content imbalance in the trait table, and it is the
  category that feeds the largest achievement category (social, 46 of 157) and
  the busiest engine subsystem (alliances). Six social traits is not enough to
  differentiate 24 tributes' social behaviour.
- `Hardened` at 3.45 (2.8 sd above the combat mean) was examined in the last
  pass and correctly judged to be a large *sum* of offsetting modifiers rather
  than a large net. It holds 36 entrants at 11.1% in probe A. Leave it; but the
  metric that flags it is measuring the wrong thing and will keep flagging it.
- `Unremarkable` at 2.92 sd is a trait whose *name* promises no modifiers and
  whose modifier sum is second-highest in its category. Whether or not it is
  balanced, that is a legibility problem.
- `Oathbound` at 0.35 is the coldest trait in the game.

### 8.5 Earned traits: survivorship, correctly labelled

The script's warning is right and worth repeating so nobody reads these as power
levels: you cannot earn `Vulture` without having already survived four deaths.

```
Silent Step 426/26.06%   Hollow 218/24.31%   Merciful 135/23.70%   Feared 431/21.35%
Waterborn 113/20.35%     Firetouched 311/17.36%   Bloodied 2167/12.09%
Starved 1064/12.03%      Star-Crossed 124/10.48%  Oathbound 253/9.88%
Haunted 939/9.58%        Venom-Wise 130/9.23%     Marked 391/5.37%
```

All 17 earned traits are reachable (the last pass's fix). Distribution is the
expected long tail. `Trapwise` does not appear in this table at all: the printed
tables filter to a minimum sample size and it does not clear it. Probe A measured
7 holders across 120 runs, which is §1.9.

---

## §9 — Replayability, and keeping the game from going stale

### 9.1 What already fights staleness, measured

This is a genuine strength and the numbers say so:

- **Games profiles**: 9 temperaments (standard 326 … lavish 98) multiply the
  player's config before the run starts.
- **Quells**: 8 kinds, all reached, 12% of runs.
- **Wildcards**: a scheduled disruption per run, plus `extraWildcardsFired` on
  3.7% of samples.
- **Procedural arenas**: 12 biomes, each with ≥16 authored events, ≥2
  once-per-run, a chain and ≥8 ambient lines.
- **Arena laws**: 15, stacking, verified to completion in 9 combinations.
- **Cast shape**, mentor legacy (win rate 8.4% strong → 3.7% forgotten — legacy
  is a real, measurable axis), district legacy carried between runs, the Hall of
  Fame, and victor-as-mentor carry-over.
- **Run length spread**: sd 2.40 days against a goal of ≥ 2.0. Runs genuinely
  differ in shape.

### 9.2 The structural problem: variety is front-loaded

Every axis above is decided **before the first cycle**. Temperament, Quell,
arena, law, cast shape, mentor legacy — all fixed at generation. The one
mid-run variable is the wildcard, which fires from a menu of five (§6.1).

So two runs of the same arena with the same temperament are, after cycle one,
the same run with different names. The evidence is `test:decisions`: destination
matches best-scoring 65% of the time and stance 56.3%, which means the simulation
is substantially deterministic given a starting state. That is *correct* for
plausibility and it is exactly what makes a mid-run variety axis necessary.

**The single highest-value replayability change in this repository is a second
and third scheduled disruption with a real menu behind them** — not the
`extraWildcardsFired` path (3.7%), but a guaranteed day-4 and day-7 turn drawn
from a pool of twenty. The `gamemakerAgency` system fires in 118 of 132 runs and
is the right home for it.

### 9.3 The other axes worth opening

1. **Mid-run law changes** (§5.6.2) — the arena itself changing its rules on day
   four, announced.
2. **A campaign layer.** `AUDIT-2` §9.4 raised it and it was not taken up.
   District legacy already moves between runs and already produces a 2.3x win
   spread across legacy tiers. Letting the player *play a district across
   several Games* — the same mentor, the same record, the same grudges — turns
   a run into an episode.
3. **Player-authored constraint.** `gamesProfile` picks the temperament. A
   "choose your Quell" mode, or a draft in which the player picks one law and
   the Gamemakers pick the other, converts a random axis into a decision.
4. **Asymmetric information as a mode.** `spoilerSafe` already proves the UI can
   withhold. A mode where the player sees only what their sponsored tribute sees
   is a different game on the same engine.
5. **Seeded weekly.** The share/replay-by-URL infrastructure already exists and
   is tested. A daily or weekly fixed seed with a leaderboard costs almost
   nothing and is the cheapest retention mechanic available to a game that is
   already fully deterministic.

### 9.4 Two things that will make it *feel* stale before they are numerically
significant

- **15 grief lines** (§7.4). A player sees the whole pool in one run.
- **The five-wildcard menu** (§6.1). By run ten the player has seen every
  scheduled disruption twice.

---

## §10 — Shallow and incomplete mechanics; names and flavour

### 10.1 Mechanics that are shallower than their code suggests

Each of these is a real system with a real implementation whose *observed*
surface is a fraction of its designed one:

| mechanic | designed | observed |
|---|---|---|
| Traps | 5 kinds | 4 buildable, 2 in practice (§1.2) |
| Rumours | 4 kinds, true or false | 2 can be true (§1.3) |
| Feast themes | 4 | 4 (§5.4) |
| Alliance roles | 4, meaningful | 4, uniform, meaningless in 46% (§4.3) |
| Alliance pacts | 6 kinds | modal kind is `no-pact` at 46% (§4.2) |
| Objectives | 8 kinds | 3 kinds are 5.8% combined (§3.3) |
| Zone effects | 10 kinds | top one is 34%, positive one is 3% (§5.3) |
| Love triangles | a system | 1 run in 132 (§6) |
| Bloc treaties | a system | 0 runs in 132 (§4.7) |
| Legendary items | named weapons, 28 lines | not observed (§6.2) |
| Loans | a light grievance | 2.2% of tribute-cycles (§4.6) |
| Sanity recovery | bidirectional | 0.65% of tribute-cycles (§6.4) |
| Social traits | a category | 6 traits vs 25 and 27 (§8.4) |

### 10.2 Mutts: 196 authored, 37 still role-less, 155 reachable

The last pass gave 85 mutts a behavioural role, taking 74 → 159 of 196.
**37 remain role-less**, deliberately, as "plain" mutts. Probe C observed **155
distinct mutts across 132 runs**, so roughly 41 are rare enough not to appear in
132 runs — which for arena-specific rosters is expected, not a fault.

`MuttRole` has seven members (`ambusher`, `herder`, `scavenger`, `siege`,
`mimic`, `swarm`, `parasite`). Worth checking whether all seven are *assigned* —
`mimic` and `parasite` are the two that most change how an encounter reads, and
the role assignment was derived from names and stat blocks, which biases toward
the physical roles.

### 10.3 Names

`test:names`: **3,200 names across 16 districts** (200 per district, split by
gender), **124 mentors** (≥6 per district, none shared), 191 names appearing in
two pools and none in three, and no themed name outside its district. The
district naming voice is deliberate and documented (Careers ornate/Roman, outer
districts plainer).

What is missing, in order:

1. **Surnames.** Raised in `AUDIT-2 §11.5`; not taken up. Every tribute in the
   game is mononymic. A surname pool is the single largest identity multiplier
   available: 3,200 given names × even 300 surnames is effectively unlimited,
   and it makes **district families** expressible — two tributes reaped from the
   same family is a scene the model currently cannot stage.
2. **A third name pool per district.** 191 names appear in two pools already,
   which means the pools are being stretched.
3. **More mentors.** 124 mentors against 3,200 tributes: a player who runs
   twenty Games sees the same mentor repeatedly while never seeing the same
   tribute twice. Mentors are the recurring cast and are the thinnest pool.
4. **Nicknames the arena gives you**, distinct from `epithets`. Epithets are
   working well — probe B recorded a long, procedurally varied tail ("the One
   Who Did Not Slow Down" ×111, "the Arithmetic" ×101, "the Short Way Through"
   ×90, down to one-offs). The pattern set behind them is visibly finite,
   though: "the Butcher of X", "the Count of X", "the Quiet Blade of District
   N", "District N's Reckoning", "District N's Last Word" account for most of
   the tail. Ten more patterns would be felt immediately.
5. **Item names.** 56 distinct items observed in inventories across 120 runs.
   Weapons are generic (`Sword`, `Axe`, `Machete`); `LEGENDARY_ITEM_NAMES` has
   16 entries and §6.2 could not observe one in play.

### 10.4 Flavour: where more *types* are needed

The arena flavour table is 14,774 lines and in excellent shape. The gaps are in
the generic and structural pools:

- **Grief: 15 lines** against 18 deaths per run (§7.4). Needs 40+, and needs
  *types*: grief for an ally, a lover, a district partner, an enemy you
  respected, someone you failed to reach (`diedWithinReach` exists, 86 samples).
- **Betrayal: 14 witness + 16 aftermath lines** against 5.06 betrayals per run.
  Needs types: betrayal witnessed by a third party, betrayal the victim
  survives, betrayal that fails, betrayal by someone who owed a debt.
- **Mentor: four pools at 12–18 lines.** Mentors are the recurring cast (§10.3);
  they have the thinnest voice in the game. Needs types by legacy tier — a
  `forgotten`-district mentor and a `strong`-district mentor should not sound
  alike, and the tier already drives a 2.3x win-rate difference.
- **Interview: 13 scenarios** against 12 personas. One scenario per persona plus
  one. A second and third scenario per persona is the cheapest way to make the
  pre-Games differ between runs, and the pre-Games is 12,117 log lines per 120
  runs — the fourth-largest category in the game.
- **Quirks: 85, thinnest at 4 line variants.** Fine, but the floor is 4.
- **Nested pools: 137, thinnest `ARCHETYPE_SIGNATURE_TEXTS.careerDeclaration`
  at 8.** Archetype signatures fire on 38.5–60.5% of entrants (§8.2); eight
  lines for the Career declaration means a 24-tribute field with 6 Careers
  exhausts most of it in one reaping.

---

## §11 — More achievements to add

### 11.1 Where the achievement layer is

157 entries across eight categories: social 46, survival 21, combat 20, arena
20, capitol 19, games 12, oddity 10, reaping 9. 93 in the usable 5–60% band; 17
never unlock (§1.6); 3 near-automatic (≥60%); 7 rarity labels drifted; 72
numeric thresholds all carrying a `nearMiss`; `test:predicates` and the numeric
ceiling check both clean.

That is a well-run system. Before adding anything, the 17 that never fire should
be fixed or retired — a player who completes everything achievable is looking at
17 permanently grey rows, seven of which do not even say what they want.

### 11.2 Category imbalance

`reaping` has 9 entries and `oddity` 10, against `social`'s 46. The reaping is
the phase with the strongest existing state (volunteering, district, legacy
tier, mentor, `castShape`, Quell rules, training score, `fanFavourite`,
`interviewStrategy`) and the fewest achievements attached to it.

### 11.3 Achievements to add, keyed to state that already exists

Each line below names the field that scores it, so none of these needs new
engine work.

**Reaping and pre-Games** (`reaping`, currently 9)
- *Volunteered for a stranger* — a volunteer with no district-partner tie.
- *Twelve and still standing at the feast* — `age` 12 alive at `feastDay`.
- *Read the room* — `interviewStrategy` matched the year's `temperament`.
- *Outscored the Careers* — `trainingScore` above every `isCareer` tribute.
- *The mentor was right* — `mentorWithheld` was set, and they won anyway.
- *Nobody's favourite* — `fanFavourite` false, `reputation` bottom quartile,
  victor.
- *A forgotten district crowns one* — `legacyTier === 'forgotten'` victor.
  (Measured 3.7% — a genuine rare.)

**The arena and its interior** (`arena`, 20)
- *Slept in every kind of ground* — distinct `Terrain` in `memory.zones`.
- *Held the high ground* — victor whose zone was `ZoneLevel: 'upper'` every
  night. (`ZoneLevel` is currently under-read; this gives it a reader.)
- *Walked a one-way map* — victor in an `oneWayBorders` arena.
- *Outlived the map* — alive in a zone listed in `collapsedZones`.
- *The arena's own list* — triggered three distinct `zoneEffects` kinds.
- *Two laws, one crown* — victor in a stacked-law arena (`test:arenas` already
  plays nine such combinations).

**Fieldcraft and survival** (`survival`, 21)
- *Set a line and slept behind it* — a trap in your zone while `watch` posted.
- *Beat the fever* — `terminalInfectionBeaten`. (Currently 10 samples in 12,083
  — a true legendary, and one with a near-miss the player can feel.)
- *Never drank standing water* — no `purification` use and no dehydration damage.
- *Off-hand* — a kill with `woundedSide === handedness`.
- *Slept the debt off* — `sleepDebt` from max to zero.

**Alliances and the social layer** (`social`, 46 — these fill gaps rather than
add bulk)
- *Chartered and kept it* — an alliance with `breaches === 0` at dissolution,
  scaled to charter length. (`charterKeptSeen` exists, 685 samples.)
- *The heir* — `succeededAsHeir` (246 samples) and then won.
- *Paid every loan* — `loans` opened and all settled. (Gated on §4.6.)
- *Bought the peace* — a truce with `truceReason: 'extortion'` that held to
  expiry.
- *Four hats* — held all four `roles` in a group of four or more. (Gated on
  §4.3 — currently trivially true in a pair, which is why it cannot be added
  today.)
- *Let them go* — an `expelledIds` member who outlived the group that expelled
  them.

**The Capitol** (`capitol`, 19)
- *Unsponsored* — victor with `sponsorTrust` never above its starting value.
- *Cost them the broadcast* — victor in a `noCannons` or `noSponsors` arena.
- *The bloc that backed you* — won on a single `sponsorBlocBudgets` patron.
- *Made the Gamemakers blink* — a `gamemakerSignatureFired` aimed at you,
  survived. (`gamemakerAgency` fires in 118/132 runs; nothing scores surviving
  it.)

**Oddity** (10 — the category with the most room and the least risk)
- *Nobody died today* — a full day-and-night with zero deaths.
- *All twelve still standing at the feast.*
- *The shortest Games* — run ended on day 3 or earlier. (Run-length sd is 2.40,
  so this is reachable and rare.)
- *Won without leaving the Cornucopia* — one zone in `memory.zones`.
- *Won having seen the whole map* — the existing `grand-cartography` rung, but
  as an oddity rather than a survival goal.
- *Two crowns* — a dual victory. (9 in 400 runs — a natural legendary, and
  `victorIds` is the field that scores it, which would also give §1.9's
  unread field a reader.)

### 11.4 One process change

Seven of the 17 never-unlocking achievements carry no `nearMiss`, which is the
worst combination: unreachable *and* invisible. Make `nearMiss` mandatory for
every entry the sweep has never seen unlock — the check already knows which
those are, so it is one assertion in `check-achievements.ts`.

---

## Closing: the ten things worth doing first

Ordered by value per line changed, with the section that argues each.

1. **Rename the duplicate `crevasse-worms` id** and assert mutt-id uniqueness in
   `test:arenas`. One line plus one assertion. (§1.1)
2. **Give every arena event an `id`**, by codemod, and add the `test:flavor`
   assertion that each fires at least once across the sweep. This is the change
   that lets every future content question be answered by CI instead of by a
   throwaway probe. (§1.4)
3. **Mint true `restock` and `cache` rumours** from `cornucopiaRestocks` and
   from live caches. Both states already exist on `GameState`. Restores half the
   rumour taxonomy. (§1.3)
4. **Report the unguarded archetype spread** (3.33x) as its own line so the
   metrics report stops reading PASS on a statistic that excludes its outliers.
   Then fix zealot (shortest life in the game, lowest signature fire rate) and
   saboteur (survives, never converts). (§1.5, §8.2)
5. **Build the `stake` trap, and loosen the `snare`/`tripwire` material gate.**
   Five of 347 traps is a two-item menu with three items written, and it is the
   mechanic the worst-performing archetype depends on. (§1.2, §8.2)
6. **Write 40 more grief lines and 30 more betrayal lines.** The player sees the
   entire 15-line grief pool in one run of a game averaging 18 deaths. Highest
   felt-staleness per line in the repository. (§7.4, §9.4)
7. **Fix or retire the 17 never-unlocking achievements**, make `nearMiss`
   mandatory for them, and derive rarity labels at build time so they stop
   drifting every release. (§1.6, §11.4)
8. **Scale alliance roles to group size** and give the quartermaster a
   consequence. 46% of alliances are pairs wearing four hats. (§1.8, §4.3)
9. **A real mid-run disruption menu.** Twenty entries behind a guaranteed day-4
   and day-7 turn, fired through `gamemakerAgency` (already live in 118/132
   runs). Every existing variety axis is decided before cycle one; this is the
   only one that is not. (§9.2)
10. **Surface `zoneDepletion` and `structuralFatigue` on the map**, and fix the
    four dialogs without focus management. The engine measures p50 0.19 / p90
    0.71 depletion and shows the player none of it. (§2.2, §2.6)

Two structural notes to close on.

The first audit found a game whose systems did not work. The second found a game
whose systems worked and did not happen. **This one finds a game whose systems
work, happen, and cannot be counted** — five dead enum members, 1,123 events
with no identity, and a balance guard that excludes the two archetypes that fail
it. The fix is the same convention `AUDIT-2` proposed and that the roster has
only half-adopted: every enumerable kind gets a counter, and a counter reading
zero fails the build exactly like a violated invariant.

The second: the depth here is real and unusually well-documented — the type
comments in `models/types.ts` explain not just what each field is but what was
wrong before it existed. That is why an audit like this can be written in an
afternoon, and it is the most valuable asset in the repository. The content
pools that are thin (grief, betrayal, mentors, interviews, social traits) are
thin in exactly the places where the *engine* is deepest, which is the good
problem to have: the machinery is waiting for the words.
