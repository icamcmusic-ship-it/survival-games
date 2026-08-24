# Survival Games

A highly replayable, robust text-based survival/tribute simulator with dynamic arenas, attributes, and a gamemaker mode.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

## Build

`npm run build` outputs a static site to `dist/`, deployed to GitHub Pages via `.github/workflows/deploy.yml` on push to `main`.

## Tests

- `npm run lint` — TypeScript type check.
- `npm run test:sim` — headless soak test: hundreds of complete runs across every
  arena and config spread, asserting no infinite loops, vitals within range,
  unique names and log ids, no unreplaced text placeholders, and deterministic
  output for a fixed seed. It also asserts the behavioural invariants — zones
  recover instead of depleting permanently, no tribute thrashes stance cycle to
  cycle, relationships stay inside their bounds under grief and betrayal, every
  obituary names the source that actually landed the killing blow, and no
  mechanic (vengeance, group combat, retreat, grief) silently never fires.
  Prints the training-score distribution and a behaviour summary.
- `npm run test:arenas` — structural check on the hand-authored arenas: every
  distinct stacked-law combination the roster ships played to completion and
  asserted to have actually been in force (this found `noSponsors` being
  enforced in `sponsors.ts` and nowhere else, so a mentor's parachute went on
  landing in the two arenas where nothing is supposed to reach anybody), zone
  graphs connected and symmetric, every arena backed by its own flavour pack,
  every arena carrying at least twelve of its own authored events (below that it
  spends most of a run speaking in the shared universal voice rather than its
  own), every climate profile in `engine/climate.ts` carrying a matching label in
  `data/arenaBriefing.ts` so the setup screen's briefing cannot silently drift,
  and every terrain an arena is made of covered by at least one mutt that can
  appear on it — `terrainPreference` is a hard filter, so an uncovered terrain
  is a permanently mutt-free zone rather than a merely quiet one.
  It also scans the source for seeded shuffles written as
  `sort(() => rng() - 0.5)`, which is deterministic within one JS engine but
  consumes a different number of RNG draws in another — so a same-process
  replay test can never catch it, and the Share URL silently stops replaying
  the same Games in a different browser.
- `npm run test:names` — reaping-pool guard: every district pool carries a full
  stock (districts 13-16 once shipped at 30 entries per gender against the
  original twelve's 100), no pool repeats itself, and no name is resident in
  more than two districts at once (`Sable` was in five).
- `npm run test:flavor` — flavour-pool depth. A run averages ~650 log lines and
  swears ~10 vengeance oaths, so a 10-entry pool repeats itself inside a single
  Games as a matter of arithmetic. The backlog is now empty: every pool is at or
  above the 12-entry target and the allowance is zero, so a new thin pool fails
  the build rather than joining a list. Topping a pool up is always allowed.
  It also prints — and guards — the four content surfaces that are not flat
  `string[]` exports and were therefore invisible to the global floor: per-arena
  authored event pools, interview scenarios bucketed per persona (all thirteen
  are at the target, and the guard is the target rather than the hard floor),
  per-quirk line variants, and the four conditional-stance action pools
  (`fortify`/`scavenge`/`shadow`/`flail`), which `test:arenas` never checked
  because it only knew the original five. That last one found a real backlog —
  most arenas that author them author four entries against a generic fallback of
  twelve, which makes an authored pool *worse* than none — so it ratchets the way
  the global allowance does and can only shrink.
- `npm run test:knobs` — fails the build on a knob declared in `data/balance.ts`
  that nothing in `src/` reads, so a dead dial cannot silently absorb tuning
  effort.
- `npm run test:undeclared-knobs` — the inverse: fails on a *new* tunable number
  typed straight into `src/engine/` instead of into `data/balance.ts`. It looks
  for the three shapes a knob almost always takes — a literal passed to
  `chance()`, a literal on the right of `+=`/`-=`, and a literal on one side of
  a `<`/`>` threshold — and ignores the structural cases (array indices, 0/1/2,
  `.length` comparisons, the `Math.round(x * 100) / 100` idiom, loop bounds,
  `slice`/`padStart` arguments). Two escape hatches: annotate a genuine one-off
  with `// balance-exempt: <why this is not a knob>` on the line or the line
  above it, and `scripts/undeclared-knobs-baseline.json` freezes the sites that
  predate the check so it fails only on new drift. Migrate some of them and the
  check tells you to shrink the baseline with
  `npx tsx scripts/check-undeclared-knobs.ts --write-baseline`.
- `npm run test:metrics` — the softer question the soak cannot ask: is the
  simulation producing the *shape* of outcome the design wants? Alongside the
  win-rate tables it reports three things that used to be guesswork: trait power
  level (every numeric modifier bucketed by category, magnitude summed per trait,
  anything more than 1.5sd off its category mean flagged — a proxy for power, so
  a report rather than a guard), per-archetype signature fire rate (fourteen
  archetypes fire between 40% and 60%; Ghost fires at 19.8%), and win rate by
  district legacy tier, which is the check that "starts behind on purpose" has
  not quietly become "cannot win".
- `npm run test:ui` — Chromium smoke test covering every screen, control and
  keyboard shortcut; fails on any console or page error. Needs `npm run dev`
  running on port 3000.

## How a run works

`setup → reaping → training → interviews → bloodbath → day/night cycles
(with feasts) → epilogue → debrief`

The whole simulation is seeded: the same seed plus arena always replays the
same Games, which is what the Share button encodes into a URL.

Every logged event carries a semantic category (kill, hazard, alliance,
sponsor, sanity, …) that drives the colour coding, the glyphs and the filters
in the chronicle.

The training phase is three narrated days, not one summary line: each day is a
station attempt with a visible outcome (success, a public struggle, a public
failure), mingling between tributes at the same station, pre-agreements struck
on the floor, altercations between people who already disliked each other, an
observation pass that writes respect and fear, and an evening beat.

The chronicle can be read two ways. The in-arena sidebar is a live ticker; the
`#/chronicle` page is one phase per full-width page, with event cards, tribute
tiles, a phase scrubber and deep links (`#/chronicle?day=4&phase=night`). Both
read the same filter state.

## How the simulation is put together

The engine is deliberately wired so subsystems feed each other rather than
running in parallel:

- **Combat** (`engine/combat.ts`) resolves as multi-round exchanges with a
  retreat check every round, and handles three-or-more-tribute zones as real
  group fights with a numbers advantage and focus fire. Every point of damage
  records its source, so cause of death is the thing that actually killed you.
- **Stealth** (`engine/stealth.ts`) is concealment versus awareness: a hidden
  tribute is not found at all this cycle, and a tribute who opens a fight from
  cover gets a free hit. The Gamemakers strip cover away once the field is down
  to the last few, so nobody can hide their way to a stalemate.
- **Exposure** (`engine/exposure.ts`, `engine/climate.ts`) is one system. An
  arena's standing weather and a Gamemaker-triggered storm are the same kind of
  object — a profile describing what the weather does to a body — so they
  cannot drift apart or stack two different freeze implementations on the same
  tribute.
- **Memory** (`engine/memory.ts`) is what each tribute personally knows: which
  zones cost lives, who was standing where, how picked-over the ground is, who
  they owe a debt to. Movement, stance and targeting all read from it.
- **Relationships** (`engine/relationships.ts`) own every write to the social
  graph. Tributes start with backstory ties (district partners, academy
  classmates, age gaps), bonds decay without contact, deaths propagate grief and
  vengeance to everyone who cared, and betrayal dents the numbers whether or not
  the fight that follows resolves.
- **Bodies** (`engine/physique.ts`) are two independent axes rather than one
  adjective. *Frame* is skeleton — fixed at the reaping, correlated with height,
  and worth reach, carry capacity, grapple resistance and how dangerous you look
  across a zone, against concealment, chokepoint passage, climb speed and hunger
  drain. *Condition* is soft tissue — mutable, and worth cold insulation, a
  starvation buffer and injury absorption, against agility, heat tolerance and
  water. The two pull opposite ways, and condition *degrades*: a tribute who has
  been starving for six days walks Padded → Lean → Wasted and loses their
  insulation and their buffer at exactly the moment they need both, while their
  reach and their intimidation value are unchanged. Limb-length ratio and
  handedness sit alongside them, so a ruined weapon hand is a different injury
  from a ruined shield side.
- **Alliance pacts** (`engine/alliancePact.ts`) are a union rather than a
  constant: dissolve at a field size, on a day, at the feast, when the Career
  pack falls, when one of them is badly hurt, or when a named target is dead.
  The field threshold is rolled against the *live* field with a two-death slack,
  so a small-field run can never swear to a deadline it is already past — and
  the dissolution ceremony only fires once the field has actually fallen far
  enough to earn it.
- **Alliance politics** (`engine/alliancePolitics.ts`) is the interior a group
  was missing. Factions are *detected* from per-pair suspicion rather than
  declared, and resolve as a coup or a walk-out; a second breach of the same
  charter clause by the same member is a hearing that expels, demotes or
  forgives; and a cache-contribution ledger gives a departing member a claim.
- **Rapport** (`engine/rapport.ts`) covers the three things the social graph
  could not do: third-party inference (everyone standing in the zone updates
  their model of a pair, which is the most useful thing anyone in an arena can
  learn by looking), reconciliation (rivalry cools with quiet time and much
  faster with shared survival), and respect as a real currency — who you go
  after last, and whose report your group actually acts on.
- **Intent** (`engine/intent.ts`) gives the decision layer a two-deep objective
  queue (an errand can be put in front of a goal without discarding the goal),
  a way for sustained tension to resolve, a decision at the end of repeated
  foraging failure rather than a modifier, an aggregate `dread` distinct from
  resolve, and deception in movement — a false trail that poisons `zoneTraffic`
  and everyone else's zone memory.
- **Zone economy** (`engine/map.ts`) makes forage a finite stock that depletes
  and regrows, so a resource-rich zone is a prize other tributes can strip. A
  tribute who can read ground — enough forage proficiency to have watched it
  come back before, or enough intelligence to work it out — reckons when a
  stripped zone is *due*, and movement pulls them back toward it instead of
  penalising it, which is what turns depletion from a permanent "do not return"
  flag into a boom-bust cycle worth learning.
- **Zone interiors** are three shared primitives rather than three hand-authored
  gimmicks. `ZoneFeatures.acoustics` is how far sound carries out of a zone —
  derived from terrain and cover, overridable by any arena, and read by the
  stealth layer, so a canyon gives a hider away and deep timber does not.
  `ZoneFeatures.vertical` (`engine/verticality.ts`) gives a zone an inside with a
  height to it: tributes stand at `upper` or `lower`, two on different levels are
  not in the same place and do not meet, and the descent costs fatigue and
  carries a fall risk. `engine/loadBearing.ts` is structural fatigue — occupation
  and combat noise load any `ruins` zone in any arena, and past a threshold the
  universal "Load-Bearing" event can bring it down on everybody in it. All three
  are inert in an arena that declares nothing.
- **Weather** has a season (`engine/weatherFront.ts`). Every front used to be an
  independent uniform draw, so a run could go rain, freeze, dust, fog in four
  cycles and read as noise. A run rolls a direction it drifts in and the bias
  toward that extreme deepens as the run goes on; once it is established the
  feed names it.
- **Traces** persist (`engine/abandonedCamps.ts`). A zone somebody fled used to
  reset to its ambient state the instant they were out of it. A camp left
  standing is a real object now: findable, carrying salvage, and telling whoever
  finds it where a living person was and that they left fast.
- **Balance** (`data/balance.ts`) holds every tunable number the engine reads —
  vitals drains, damage, thresholds, decay rates, gate probabilities — so
  balancing a run means editing one file. Both directions of that claim are
  enforced in CI: `test:knobs` fails on a declared knob nothing reads, and
  `test:undeclared-knobs` fails on a new tunable typed into the engine instead.
  The engine sites that predate the check are inventoried in
  `scripts/undeclared-knobs-baseline.json` — that file is the honest measure of
  how far off the claim still is, and it should only ever get shorter.
- **Stance** (`engine/stance.ts`, `data/stances.ts`) is scored from a table
  rather than a block of hand-written branches. Aggressive, Defensive and
  Evasive are always available; Hunting, Fortified, Desperate, Scavenging and
  Shadowing each need a specific situation to hold, are filtered out of the
  ranking when it does not, and are vacated the moment it passes. Adding a
  stance is two data rows.
- **Archetypes** (`data/archetypes.ts`, `engine/archetypeHooks.ts`) are
  characters rather than four bias scalars: a target preference, a risk curve,
  an objective bias, declared antipathies, and one signature set piece per run.
  Fifteen of them, weighted per district and by the year's cast shape.
- **Names earned in the arena** are their own layer. A tribute's birth name comes
  from `data/names.ts` and is fixed at the reaping; an *epithet*
  (`engine/epithets.ts`) is what the country calls them for what they did here —
  awarded once, off a kill streak, a long unseen streak, or surviving past the
  point anybody expected, and used by the kill feed and the victor's interview.
  A weapon that draws blood twice earns a name of its own
  (`engine/legendaryItems.ts`) and keeps it when it changes hands, which is a
  kind of proper noun the game did not otherwise have.
- **Districts** (`data/districts.ts`) carry a Games record. A tribute from a
  storied district arrives with a mentor who has stood on the podium and a
  crowd that already expects them to do well; a tribute from a forgotten one
  does not.

The day/night phase (`phases/dayNight.ts`) is the orchestrator and nothing
else — the order things happen in. Terrain, vitals and medicine live in
`engine/survival.ts`, destination scoring in `engine/movement.ts`, threat
assessment and stance hysteresis in `engine/stance.ts`, and hazards, meetings
and sanity breaks in `engine/encounters.ts`.
