# Changelog

## Audit 3 fix pass (this branch)

Answers `AUDIT-3.md`. That report's theme was that the codebase's systems work
and happen and *cannot be counted* — five dead enum members, 1,123 events with
no identity, a balance guard that excluded the two archetypes failing it. The
theme of this pass turned out to be narrower and sharper than that: **live
state pruned before anything could read it.** The same bug, seven times, in
five subsystems, and once by the audit itself.

### The recurring bug (§1.6, §4.7, §6)

The achievement table is evaluated once, at the end of a run, against the final
state. That is the right design. Seven things were asking it about state that
does not survive to the end:

- `state.rumours` has a six-cycle lifetime and prunes exposed claims, so 'The
  Liar', 'Whisper Campaign' and 'Caught Out' were all reading for the thing
  that gets deleted.
- `state.alliances` at the end belongs to the one tribute standing, so 'Lawyers
  of the Arena' asked the wreckage for a three-clause charter.
- `state.blocTreaties` is emptied by *every* ending a treaty can have, so
  'The Treaty Year' could never be answered yes in 132 runs.
- `tickTriangles` deleted a love triangle the moment any of the three died, so
  the record was guaranteed empty by the epilogue — the system was firing in
  ~80% of runs and measuring as 1 in 132.

None needed a new mechanic. They needed somebody to write down that it
happened, the way `sharedGriefAllies` already did. `tickRunRecords` now keeps
the high-water marks; `blocTreatyHeld` and `endedBy` record the rest.

And 'Nobody Is Buying' derived "opening purse" from the largest *remaining*
purse and then required every purse, including that one, to be a quarter of it
— impossible unless every bloc sat at zero.

### Dead enum members (§1.2, §1.3)

- `Trap.kind` declares five and the sweep built two. Cordage was the sole gate
  on `snare` and `tripwire` and it is Cornucopia loot; a `stake` wanted a mutt
  venom gland *and* cordage. Ground that grows a line now gives you one, and a
  stake accepts any of the four things that can already coat a blade.
  **snare 4 → 114, tripwire 1 → 57, stake 0 → 7, traps 304 → 613.**
- `mintTrueRumours` could only produce two of four kinds, and the two it could
  not were the two `rumourPull` prices as *lures* — so every lure anybody heard
  was a lie, and the lure half of the taxonomy was a tell rather than a gamble.
  **true claims: restock 43, holed-up 295, cache 69, empty 72.**

Both now fail the build if any kind reads zero.

### Events that can be counted (§1.4)

1,123 of 1,323 authored arena events carried no `id`, because `id` was
documented as optional and almost every event took the option. `oncePerRun`
keys on it, `eventLastFired` keys on it, and nothing could count them —
answering "does this event ever reach a player" took a throwaway script
matching log text against templates by longest literal substring.

Ids are now derived at load from the arena id and a slug of the text: **1,449
of 1,449**, no source churn, impossible to forget on a new event. The soak
measures what could not previously be measured — **713/1,388 authored events
fired at least once**, with a regression floor, per-pack thinnest-reach
reporting, and a failure on any pack where nothing ever fired.

### Balance (§1.5, §8)

The metrics report read `archetype win-rate spread 1.63x  goal <= 2.3 MET` on a
line computed over seven of fifteen archetypes, and the two that actually
missed the goal were the two the guard is structurally unable to see. The three
statistics are now also printed over the whole field, unguarded, with the goal
attached and the run count needed to confirm a change named.

What that line then showed, and what closing it took:

- **Zealot** carried the highest risk tolerance in the game on the
  second-smallest attribute budget, and its `Desperate: 0.8` stance bias — the
  largest on any archetype — was pointed backwards at an archetype whose
  description is "does not break". Now carries willpower.
- **Saboteur** survived above the median and converted none of it, because
  `springTrap` incremented `trapKills` and never touched `kills`. A tribute who
  dies in a snare was killed by whoever tied it.
- **Medic** had the Ghost's diagnosis (lasts, cannot close) and the Ghost's old
  answer. Now `late-blooming`, the curve that exists for exactly this.

Measured at 1,600 runs, every archetype at n ≥ 813:

  whole-field spread **3.33x → 1.92x** (goal ≤ 2.3x, MET)
  worst archetype **2.16% → 3.74%** (goal ≥ 3.5%, MET)
  victors with zero kills 29.9% → 27.0%

### The arena (§5)

- `blooming` is the only unambiguously good zone effect and the only thing that
  could start one was a rare authored event in eleven of forty arenas. Ground
  that has come all the way back now blooms.
- Eleven of fifteen laws were subtractions. Two that give: `bountifulGround`
  (the Story Wood, which takes medicine away, now has one place that heals) and
  `dawnMercy` (the Carnival — and pointed at the horn, the highest-danger tile,
  so the law makes ground worth contesting).
- Four more feast themes, including the two the format could not express:
  `tokens` and `empty`, where everything happens and nobody leaves holding
  anything.
- `check-arena-layout` sampled twelve procedural seeds against twelve biomes and
  a sixteen-zone ceiling. Widened to 120 — and it immediately found a real
  defect: two nodes 71.4 units apart against a 72-unit touch target, because
  the three layout passes ran once each in order and two of them move nodes
  after separation settles. Now run to a fixed point.

### Content (§7, §8.4, §10)

- **Grief 15 → 55 lines.** Fifteen against eighteen deaths a run means the
  player sees the whole pool inside one Games. Highest felt-staleness per line
  in the repository.
- **Betrayal witness 14 → 30, aftermath 16 → 32**, against 5.69 betrayals a run.
- **Mentors speak by legacy tier** — 80 new lines. The tier already drives a
  2.3x win-rate difference, so the game was already saying a forgotten-district
  mentor and a District 1 mentor are not alike, and only the prose disagreed.
- **Mentor pools 124 → 204**, twelve per district. They are the recurring cast.
- **Thirteen universal hazards**: drowning, falls, dying in your sleep — all of
  them things the model already tracked the state for and had no death for.
- **Social traits 6 → 14.** Six could not differentiate twenty-four tributes.

### The mistake worth recording

Adding thirteen hazards moved the universal pool from 18.8% boons to 14.8%.
That pool takes a fixed ~30% of every arena's draw, so it is a real rise in
ambient lethality, and the archetype whose edge is keeping people alive paid for
it: **medic 4.19% → 2.91%, spread 1.96x → 2.75x.** Isolated by stripping the
thirteen and re-measuring at 1,600 runs rather than by guessing. Corrected by
weighting them and adding four boons. "More ways to die" was the ask; raising
the death rate of the whole simulation was not.

### Interface (§1.7, §2)

- Four `role="dialog"` surfaces had no focus management; `CommandPalette`
  declared `aria-modal` and implemented none of it. `TributeModal` hand-rolled
  a copy of `useDialogFocus` that had already drifted from it.
- **141 `title=` attributes**, and for a lot of controls the `title` was the
  only statement of what the control does — the Gamemaker levers read
  "Ignite 40" with the effect in a tooltip. A native tooltip never appears on
  touch. `components/Hint.tsx` replaces them; **53 → 31 on controls**, with
  `npm run test:ui-affordances` as the ratchet.
- Four pieces of live state the engine wrote constantly and the interface never
  showed: `structuralFatigue`, `climateDrift`, `truceLedger`, and the weather
  front — the only hazard in the game with a position, which means it can be
  walked away from.
- The chronicle's "show earlier entries" paged 200 at a time instead of
  rendering the whole run.

### Achievements (§1.6, §11)

  never unlocked **17 → 6**, all legendary, all carrying a nearMiss (now
  enforced); rarity labels contradicted **12 → 0**; **157 → 170 entries**, with
  reaping 9 → 12 and oddity 10 → 14 against social's 48.

`npm run fix:rarity` writes the labels back rather than printing a blob to
paste by hand, which is why they had drifted three audits running. The sweep
runs at 500 rather than 200: it measures the ceiling every threshold is checked
against, and a legendary is by definition something a short sweep may not see.

### Nine findings withdrawn

Written up in `AUDIT-3.md` rather than quietly dropped, because an audit that
hides its own errors is worth less than one that does not.

- **§6.1/§9.2 (wildcards "five in rotation", and the top-ten recommendation
  built on it).** `firedWildcards` indexes *this run's calendar*, not the
  wildcard table. There are 40 kinds and every run draws 2–5. The report asked
  for a pool of twenty.
- **§6 (love triangles, 1 run in 132).** The system fires in ~80% of runs; the
  record was being deleted. The soak's own `triangles: formed=358` line said so
  and the probe did not read it — the same mistake this report documents five
  achievements making.
- **§6.2 (legendary items never observed).** The probe guessed
  `item.legendary`; the field is `item.legendName`.
- **§3.4 (eleven unguarded divisions).** Every one is guarded, mostly three
  lines above the division.
- **§2.4 (reduced motion).** Honoured globally by a `*` rule. `motion` was an
  unused dependency, now removed — the real and much smaller finding.
- **§2.7 (onClick on divs).** All four are `stopPropagation` guards on dialog
  panels.
- **§1.2 (the `stake` branch does not exist).** It did; the grep started one
  line below it. The measurement was right and the diagnosis was wrong.
- **§1.9 (38% of items carry no quality).** Weapons and armour only, by design.
- **§2.6 and §4.6** each had rows measured with the wrong instrument.

### Left open

Six achievements still never unlock in 500 runs. All six are legendary, all six
carry a nearMiss, and each is a genuine sub-0.2% outcome rather than an
unreachable one — `every-door` wants every once-per-run event in a single
Games, `the-unwitnessed` a victor who never shared a sector with anybody. They
are the tail the category is for.

Surnames (§10.3) are not done. They are the largest identity multiplier
available — 3,200 given names against 300 surnames is effectively unlimited,
and district families become expressible — but they touch display, uniqueness,
epithets and save migration, and that is a feature rather than a fix.

## Audit 2 fix pass (this branch)

Answers `AUDIT-2.md`. The theme of that report was that the check roster is
very good at "does this run without violating an invariant" and had no
vocabulary for "does this ever occur" — so most of what follows is a mechanic
that was wired, tested and never reached, plus the counters that now stop that
happening again.

### Correctness (§1)
- `killTribute` deleted `victim.allianceId` 139 lines before
  `propagateDeathFallout` read it, so `wereAllied` and `areLovers` were
  permanently false. Measured over 120 runs before the fix: that branch ran zero
  times, the lover `TRAGEDY` beat fired zero times across 19 runs with a live
  pair, `Haunted` was never granted and `Hollow` was unreachable by
  construction. The teardown now runs after the fallout.
- The Haunted gate, testable for the first time, was far too wide (702 grants
  per 120 runs). Now: watched, and a bond past the median for such deaths.
  Haunted 456, Hollow 64, `hollowCycles` 6 → 10.
- `earnTrait` no longer narrates a conversion — `transformTrait` already logs
  its own line, so every trait arc narrated twice and the first line carried a
  bracketed trait id. 120 such lines per 120 runs; now zero, and the soak fails
  on the shape.
- `Trapwise` was never granted: the Saboteur signature incremented
  `trapsDisarmed` without checking for the trait, and two disarms was the square
  of a rare event. Wired up, lowered to one. All 17 earned traits are reachable.
- The suspicion axis gated four mechanics at 35–60 against a distribution where
  98.5% of samples sat under 35. Added the one ambient source it lacked (doubt
  from an ally's absence), slowed decay, and placed the thresholds on the
  measured distribution. Pre-emptive betrayals 0 → 14, departures 0 → 77,
  investigations → 180, faction actions 127 → 245, expulsions 39 → 104.
- The `wait` objective was held in 0.0% of cycles, gated on `fatigue > 45` —
  backwards for an ambush — and did nothing when held. Inverted the test, gave
  it an ambush payoff in `rollAmbush`. 0.0% → 1.1%.
- Scars required injury grade 3, which is the grade that kills you: 2 tributes
  in 1,920 ever carried one and no victor ever did. Now grade 2, as a declared
  knob. 56 tributes per 80 runs.
- `diedWithinReach` excluded the purest case — somebody in the same zone who
  would have helped and did not.

### Achievements (§11)
- `check-achievements` now measures the ceiling of every optional numeric and
  array length on `Tribute` and `GameState` across its own sweep, and fails on
  any threshold above it — the numeric twin of `test:predicates`. Two ceilings,
  since most entries score the victor and the victor is not a field's best case.
  It found fifteen unreachable entries, eight of which the audit had missed, and
  caught one I introduced myself mid-fix.
- Nine lowered to the measured ceiling; four re-scoped, because the rung below
  was occupied or the field was structurally unreachable (`performed-to-the-end`
  wanted a live performance streak on a victor, and the last one standing has
  nobody left to perform to, so the final cycle always zeroes it).
- `seen-everything` and `grand-cartography` asked a victor to walk the whole
  map. A victor covers 40% of it at the median and 89% at the very best; both
  now ask for a reachable share.
- All 45 drifted rarity labels regenerated from a 600-run measurement.
- Never unlocked 29 → 19; usable 5–60% band 87 → 91 of 158; near-automatic
  4 → 3.

### Balance (§8)
- Six archetypes took `nearest`, the null targeting preference, and eight took
  `flat`, the null risk curve. Filled in from what each archetype is.
- Added a fourth risk curve, `late-blooming`, because the three existing ones
  could not express "careful early, decisive late" — which is exactly the Ghost,
  the archetype with the second-longest survival and the worst win rate.
  Ghost 2.78% → 5.25%, spread 1.67x → 1.51x.
- `finaleAfterFinalistCycles` 4 → 2: the Gamemakers waited four cycles before
  driving the last two together, and finalist damage protection means those were
  mostly two people failing to meet. Victors with zero kills 32.2% → 29.9%; runs
  with no victor 2.0% → 1.3%, now meeting its design goal.
- 22 of 23 indicators meet their design goal, up from 20.

### Content (§10)
- 85 more mutts given a behavioural role, derived from their own names and stat
  blocks. 74 → 159 of 196; 37 left deliberately plain. Roles that narrow
  *eligibility* were only assigned where they add no new restriction, so the
  terrain-coverage guard still holds.

### Measurement
- The soak now counts the four suspicion mechanics, the two grief beats, and the
  objective distribution, and **fails the build if any of them reads zero**.
  Three of the four suspicion mechanics shipped calibrated above their own data
  and stayed that way because nothing counted them.
- It also fails on any feed line ending in a bracketed identifier.
- README documents `CHROMIUM_PATH` for `test:ui`, the one check CI does not run.

### Three findings withdrawn
Written up in `AUDIT-2.md` rather than quietly dropped.
- §1.8 (`zonesBurned`/`timesTraded` as dead schema fields): those fields do not
  exist. They were names invented in the probe, and the zeros it reported were
  absent properties rather than unwritten counters.
- §3.1 ("the median tribute experiences two zones"): true, but it measures
  lifespan rather than exploration — the median tribute dies on day three. A
  backtrack penalty and an unseen-ground pull were implemented, measured at
  twenty times their sensible values, moved victor coverage two points, and were
  reverted rather than shipped dead.
- §8.4 (Hardened): already diagnosed in `traits.ts`. Its large modifier sum is
  the mitigation, not evidence of overpower.

### Left open
Map coverage (§3.1) needs `objectiveStep` to send people further, or a different
ratio of run length to arena size. That is design work rather than tuning.

## Audit 1 pass

Everything below answers a numbered section of the audit that prompted it.

### Correctness (§1)
- `nobodys-ally` could never fire (`=== false` on a field only ever set `true`)
  and duplicated `the-unwitnessed`; deleted, with its near-miss corrected and
  moved. `test:predicates` now fails the build on that shape anywhere.
- `every-door` advertises only in arenas that can produce it, and every arena
  now can: three or more once-per-run events each.
- `tickRunRecords` runs at the end of the bloodbath and the feast, not only
  the day/night loop; the near-death line is ten health and the resolve
  trough twenty, so `hairsbreadth` and `borrowed-time` are reachable.
- The truce ledger closes. Truces resolve from whichever side survives, a
  dead counterparty is checked before the clock, the epilogue closes whatever
  is still standing, and the engine counts every opening and ending at its
  site — the soak asserts they balance exactly (they do: 524 = 524).
- Eight drifted rarity labels re-derived; a label two bands off the measured
  rate now fails `test:achievements`.
- `front-loaded` and `reflection-survivor` carry a near-miss.
- `npm audit fix`; `npm audit --audit-level=high` gates the deploy, and the
  whole check roster runs in CI.
- Reduced-motion seeds from the OS setting.

### Content (§5, §6, §7)
- All 415 zones author their interior (cover, elevation, chokepoint, shelter,
  acoustics, verticality); `test:zone-features` ratchets it.
- Every arena: 3+ once-per-run events, an event chain, two signature deaths,
  two reactive events (`src/data/arenaEvents/`).
- Three off-season skins per arena (`src/data/offSeasonSkins/`).
- Arena event packs: hard floor 24, soft target 40, reported separately.

### Systems (§3, §4, §6, §8)
- Decision trace records the destination picked and its rank;
  `test:decisions` asserts decision quality.
- Trust has a stored history axis on top of the derived value.
- Pre-emptive betrayal from suspicion.
- Gamemaker levers: mercy, reveal, strip.
- Side markets: feast held, bloodless victor, wounded victor.
- Social trait hooks `persuasion` and `rapport`; Chameleon and Skittish retuned.

### UI (§2)
- "Why?" on every death card.
- Arena facets and "surprise me within this" on the setup screen.
- Copy-link on every chronicle page.

### Achievements (§11)
- Eighteen new entries, weighted to `oddity` and `games`; `both-levels`
  re-scoped now that verticality is everywhere.
