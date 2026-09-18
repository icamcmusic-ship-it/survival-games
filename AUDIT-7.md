# Survival Games — seventh full audit (12 sections)

## Context

Taken against `main` at `90e2aac` ("Merge pull request #61"), after `AUDIT.md`
through `AUDIT-6.md` and the fix passes recorded in `CHANGELOG.md`. Written to
the twelve headings the request named, in the request's own order.

**Nothing below is merged into a neighbouring section.** Where a finding belongs
in two places it is stated twice, in each section's own terms, because a report
whose sections quietly borrow from each other cannot be read one section at a
time. §1.1 is also §2.2; §1.3 is also §3.2; §1.6 is also §8.1; §1.7 is also §9.5;
§4.2 is also §10.6 and §12.2 — each in that section's own language, with that
section's own remedy.

Every number here was measured on this commit, either by the repository's own
check roster or by seven throwaway probes written against `Simulator`'s public
API (`advance`, `processTurn`, `observe`, `getState`) plus a full Playwright
walkthrough of the live dev server. All probes were deleted after measurement.
Where this report says "never", it means a counter that stayed at zero across a
stated number of complete runs. Where it says "cannot", it means a path proved
unreachable by reading, and the reading is shown.

### The repository, on this commit

| area | files | lines |
|---|---:|---:|
| `src/data` | 35 | 51,720 |
| `src/engine` | 87 | 36,872 |
| `src/components` | 38 | 8,446 |
| `src/screens` | 9 | 5,102 |
| `src/utils` | 11 | 3,314 |
| `src/models` | 1 | 2,750 |
| `src/store` | 5 | 1,823 |
| `src/ui` | 5 | 250 |
| **total** | **191** | **110,277** |

The interface — `components` + `screens` + `ui` — is **13,798 lines across 52
files**, and until AUDIT-6 put `test:ui` into CI none of it had a gate.

Content roster: 45 hand-authored arenas and a generator covering 12 biomes, 470
authored zones, 641 map edges, 216 mutts across 52 rosters, 1,523 authored arena events + 88
universal, 119 traits (96 rollable / 23 earned), 29 archetypes, 10 stances, 15
proficiencies, 105 quirks, 18 interview personas, 28 Quells, 27 wildcards + 13
Quell-only, 12 mutators, 267 achievements, 70 items, 3,360 reaping names + 384
neutral + 204 mentors.

### The check roster, on this commit

**All nineteen checks pass, and all nineteen are in CI** — including
`test:ui`, which AUDIT-6 §2.1 called the QOL blocker. That finding is closed and
this report does not re-open it.

| check | in CI | result |
|---|---|---|
| `lint` (`tsc --noEmit`) | yes | clean |
| `test:sim` (400 runs) | yes | passes, no invariant violations |
| `test:metrics` (400 runs) | yes | 25/25 regression guards hold; **6 goals unmet** |
| `test:metrics` (1,600 runs) | — | 28/28 guards hold; **8 goals unmet**; archetype rows judgeable |
| `test:decisions` (40 runs, 7,309 cycles) | yes | passes; stance-best **53.5%**, destination-best **63.7%** |
| `test:achievements` (500 runs) | yes | 267 entries, **17 never unlock**, 5 near-automatic, 7 rarity labels contradicted |
| `test:arenas` | yes | passes; 45 arenas, 216 mutts, 103 edge rules |
| `test:arena-layout` | yes | passes; 46px zone target at the 460px minimum |
| `test:zone-features` | yes | 470/470 zones carry an authored interior |
| `test:flavor` | yes | passes; **277 events short of its own soft target** |
| `test:names` | yes | 3,744 names, none in more than 2 districts |
| `test:predicates` | yes | passes |
| `test:storage` | yes | passes |
| `test:knobs` | yes | 2,324 knobs across 133 groups, all referenced |
| `test:undeclared-knobs` | yes | no new drift; 85 baseline sites across 23 files |
| `test:unnamed` | yes | 4.3% against a 4.0% baseline (see §1.9) |
| `test:ui-affordances` | yes | 0 hover-only hints, 0 unnamed values |
| `test:ui` (Chromium) | yes | **51 of 51 steps** |
| `npm run build` | yes | clean |
| `npm audit --audit-level=high` | yes | clean |

The roster is in the best state any audit has found it. Everything below is
what the roster does not look at.

### The probes

1. **Config-fidelity probe** — plays the same seed and arena twice, changing one
   config field, and counts divergent runs. 12 seeds × 5 fields. (§1.1)
2. **Storage round-trip probe** — feeds a full `GameConfig` through
   `SAVE_SLOT_SPECS[0].migrate` and `hofStorage.normalizeEntry` and diffs. (§1.2)
3. **Broad sweep** — 250 complete runs, sampling every living tribute every
   arena cycle through `Simulator.observe`: stance, objective, objective-queue
   depth, the six social-graph axes, proficiency peaks, items, personas,
   epithets, causes of death. (§3, §4, §7, §8, §10)
4. **Alliance interior probe** — 250 runs, sampling every live alliance record:
   roles filled, charter clauses, factions, successors, camps. (§4)
5. **Object-lifetime probe** — 250 runs, sampling live inventories for named
   weapons rather than reading them off the end state. (§6)
6. **Profile-draw probe** — 600 cheap profile draws for wildcard, Quell,
   temperament and cast-shape variety without playing the runs. (§9)
7. **Mutt-reach probe** — 6 runs of each of the 45 arenas, scanning the log for
   every name in that arena's own roster. (§5, §7)

An eighth measurement, `METRICS_RUNS=1600`, is the repository's own check run at
four times the CI sample. Every judgeable number in §8 comes from it, and §8.1
sets out why the 400-run figures cannot be read the same way.

### Four things this report checked and did not find

Stated up front, because a report that only lists faults reads as if everything
it did not mention is broken.

- **Legendary weapons work.** A first pass read `item.legendaryName` — the field
  is `legendName` — and reported zero. Re-measured: **81.6% of runs produce at
  least one named weapon, 47.3% of arena cycles have one live, 148 distinct
  names across 250 runs.** AUDIT-6 §6.2's "they work and nothing tells the
  player" is the accurate statement and §6.2 below carries only the visibility half.
- **Mutt rosters are fully reached.** A first pass counted 76 of 216 mutts named
  across 250 mixed-arena runs and looked like a coverage hole; that number is a
  runs-per-arena artefact, the same trap AUDIT-4 §1.5 documented for event
  reach. Measured properly — 6 runs of each arena, scanning for that arena's own
  roster — the figure is **187/187 (100%)**, summed across all 45 arenas.
- **Epithets are no longer lopsided.** AUDIT-6 §10.1 found one kind at 69% of
  all awards. Measured now: 546 awards over 250 runs, the most common single
  epithet at **2.9%**. Closed.
- **Trait and archetype balance are both healthy.** The 400-run table invites two
  wrong conclusions — an 11.3x trait spread and `herald` as the worst archetype —
  and neither survives `METRICS_RUNS=1600`, where the trait spread is **2.20x**
  against a `<= 2.5` goal and `herald` sits mid-pack at 3.75%. §8 is written from
  the 1,600-run pass throughout, and §8.1 sets out why the 400-run row is the one
  to distrust. The finding that survives is about the instrument, not the balance.

---

# §1 — All bugs

Seven, of which three are correctness bugs with proofs and four are ratchets and
guards that have quietly stopped measuring what they say they measure.

## 1.1 Five simulation-affecting settings are missing from the Share URL — *proven*

`ShareButton.buildUrl` encodes thirteen parameters and `App.tsx` parses
thirteen. `GameConfig` has **eighteen** fields. The five it drops are the sanity
dials:

| field | read at | in the share URL |
|---|---|---|
| `sanityStart` | `engine/generator.ts:536` | no |
| `sanityDrainRate` | `engine/survival.ts:755` | no |
| `sanityRecoveryRate` | `engine/survival.ts:756` | no |
| `enableHallucinations` | `engine/encounters.ts:1046` | no |
| `enableBreakdowns` | `engine/phases/dayNight.ts:1079` | no |

All five have sliders and checkboxes on the setup screen
(`SetupScreen.tsx:1281-1316`), all five are rolled by the "surprise me"
randomiser (`SetupScreen.tsx:164-168`), and all five change the run. Probe 1,
12 seeds each:

```
sanityStart:          12/12 runs diverge
sanityDrainRate:      12/12 runs diverge
sanityRecoveryRate:   12/12 runs diverge
enableHallucinations: 12/12 runs diverge
enableBreakdowns:     12/12 runs diverge
```

So a link copied from a run with `sanityStart: 40` replays a run that started at
100 — different cast state, different deaths, different victor — under the same
seed, with nothing on either end saying so. This is the exact failure mode the
comments beside `vanillaRules`, `singleVictor` and `ageMean` in `ShareButton`
were each written to close; the sanity block was added afterwards and nobody
went back.

**Fix.** Add the five to `buildUrl` and to the `config` object in `App.tsx`,
clamped to the same ranges the sliders allow (`0.25–2.5`, `0.25–2.5`,
`40–100`, and two booleans), defaulting to the current values so links written
before this keep replaying as they always did.

## 1.2 Every read of a save slot and of the Hall of Fame silently deletes config fields — *proven*

This is the `PanemRecords.recentRuns` bug of AUDIT-6 §9.3, in two more places,
and worse: there it was one field on a comparison window, here it is the
settings a run was played under.

`saveMigrations.normalizeConfig` builds a **fresh object** with twelve named
keys rather than spreading the record. Four `GameConfig` fields are therefore
dropped on every read of every save slot:

```
migrated baseConfig: {districtCount, hazardRate, betrayalRate, sponsorGenerosity,
  enableFeast, enableSanity, sanityDrainRate, sanityRecoveryRate,
  enableHallucinations, enableBreakdowns, sanityStart, plainNames}
  vanillaRules: in=true  out=undefined
  singleVictor: in=true  out=undefined
  ageMean:      in=14    out=undefined
  ageSpread:    in=1.5   out=undefined
```

`hofStorage.normalizeEntry` has a **second, divergent** config normaliser
(`hofStorage.ts:116-129`) that keeps only seven and drops **nine**:

```
hof config: {districtCount, hazardRate, betrayalRate, sponsorGenerosity,
  enableFeast, enableSanity, plainNames}
```

Consequences, in order of severity:

- **`singleVictor` is lost on every resume.** `victory.ts:44` reads
  `config.singleVictor` to close off every dual-victory route, and
  `dayNight.ts:960` reads it for the lovers' exemption in the forced finale. A
  player who asked for exactly one victor, saved, and resumed can get two.
- **`vanillaRules` is lost on every resume.** `gameStore.ts:1053` reads
  `baseConfig.vanillaRules` when rerolling a cast, and `gamesProfile.ts:252`
  reads it to decide whether the executed config passes through the temperament
  and calendar at all. A resumed Vanilla Games run rerolls into a full-chaos one.
- **`ageMean`/`ageSpread` are lost on every resume**, so a reroll after a resume
  draws from the canon tesserae bowl rather than the distribution the player set.
- **The Hall of Fame's "relaunch this victory" replays the wrong Games.** The
  comment directly above the offending block says the replay fields "must
  survive normalisation — dropping them here silently broke exact relaunches";
  it is guarding `arenaId`, `config` and `quellId` as *whole objects* while the
  object it guards is being truncated one line below.

`gameStore.ts:349` writes the full `state.baseConfig` into the archive, so the
data is there on disk. It is destroyed on the way back.

**Fix.** Delete the normaliser in `hofStorage.ts` and call the one in
`saveMigrations.ts`; then make that one spread-and-clamp rather than
rebuild-from-keys, so a field added to `GameConfig` cannot be dropped by
omission again. `test:storage` passes today because it never asserts on these
four fields — add a round-trip assertion over `Object.keys(DEFAULT_GAME_CONFIG)`
so the check fails the next time somebody adds a field to the type.

## 1.3 `PLANNING.queueDepth: 2` is unreachable — the objective queue is structurally depth-1 — *proven*

The README describes "a two-deep objective queue (an errand can be put in front
of a goal without discarding the goal)". `balance.ts` declares
`queueDepth: 2` with the comment "Two is a person; three is a planner", and
`intent.ts:34` carries a fix note saying the old one-element literal meant "the
depth knob did nothing and the queue could never hold the second goal the module
header promises".

It still cannot, for a different reason. `queueGoal` is called from exactly one
site — `objectives.ts:751` — and the only path to that site runs through
`objectives.ts:690`, which has already `shift()`ed the queue:

```ts
const queued = t.objectiveQueue?.shift();          // :690  pops the front
if (queued && isObjectiveReachable(...)) { ...; return; }   // early return
...
if (prerequisite) { queueGoal(t, next); ... }      // :751  the only writer
```

`queueGoal` computes `[goal, ...rest].slice(0, 2)`. For `rest` to be non-empty
the queue must already hold two — which it can only do if it once held two. The
state cannot bootstrap.

Measured over 250 runs, 53,996 living-tribute cycles:

```
objectiveQueue length: 0 → 51,382 (95.2%)   1 → 2,614 (4.8%)   2 → 0
```

Zero. Not rare — zero. `test:knobs` passes because the knob *is* read; nothing
checks that a knob can ever bind.

**Fix.** Queue the standing goal alongside the prerequisite rather than after
the shift — either push the displaced `previous` objective back when it was
itself interrupted, or move the `queueGoal` call above the shift so an errand
laid on top of a live goal keeps both. Then assert in `test:decisions` that
depth-2 occurs at a non-zero rate, which is the only thing that would have
caught this.

## 1.4 `TraitMod.intimidation` is read by the engine and written by nothing — *proven*

`data/traits.ts` opens with a rule: *"Every key below is read somewhere. If you
add a key, add the read site in the same change — an unread modifier is the bug
this file exists to fix."* The inverse — a key with a read site and no writer —
is unguarded, and one key is in that state.

`fear.ts:36`:

```ts
amount *= 1 + (profOf(source, 'intimidation') + traitMod(source, 'intimidation')) * FEAR.perIntimidationPoint;
```

`traitMod(source, 'intimidation')` returns 0 for every tribute in every run.
Of the 59 declared `TraitMod` keys, 58 are carried by at least one trait;
`intimidation` is carried by **no trait and no quirk**. It was added in the
AUDIT-6 §12.2 social-vocabulary pass with its read site and without its writer.

This compounds with §8.5: `intimidation` is also the proficiency with the
second-lowest measured ceiling (peak 1.68 of a cap of 6 across 250 runs), so the
whole intimidation term in `fear.ts` is contributing a rounding error.

**Fix.** Put `intimidation` on the two or three traits that obviously want it
(`Stone-Faced`, `Dead-Eyed`, `Brute`) and extend `test:knobs`'s sibling idea to
`TraitMod`: fail the build on a declared key no trait or quirk writes.

## 1.5 Two quirk modifiers are declared with a value of zero

```
'collects one thing from every zone': { scavenge: 0.04, capacity: 0 }
'hoards string':                      { ..., capacity: 0 }
```

`capacity: 0` is a modifier that was written and never given a number. Both
quirks are about carrying things, so the intended value is almost certainly 1.
Two of 105 quirks; cheap, and nothing in the roster looks for a no-op mod.

**Fix.** Give them a value, and add a zero-value scan to `test:flavor` alongside
its existing pool-depth walk.

## 1.6 `test:metrics`'s reaping-trait spread guard measures two traits and reports a verdict — *proven*

At the 400 runs CI uses, the indicator prints:

```
PASS  reaping-trait win spread (best/worst)   1.20x  (guard <= 4.5  goal <= 2.5 MET)
```

The real spread over the traits that clear the sample threshold is **2.20x**,
measured at `METRICS_RUNS=1600` (§8.1). 1.20x is not a rounding difference from
it; it is a different statistic.

The cause is `metrics.ts:434`:

```ts
const reapingTraitSpread = spreadOf(guardable(reapingTraitRates));
```

`guardable` filters to populations of `GUARD_MIN_SAMPLE = 500` or more. At 400
runs exactly **two** of the 87 reaping traits clear that — Charismatic (n=501,
5.79%) and Trapper (n=728, 4.81%) — and 5.79 / 4.81 = **1.204**. At 1,600 runs,
50 traits clear it and the row becomes meaningful.

The archetype rows immediately above handle the identical situation correctly:
they carry a `judgeable: () => archetypeGuardRates.length > 0` predicate and
print *"no population over 500 entrants at this run count — reported, not
guarded"*. The trait row has no `judgeable` predicate, so it prints a green
"goal MET" where its neighbours print an abstention.

This is the same class of instrument error as AUDIT-6 §8.5 (shares read as rates)
and AUDIT-6 §1.2 (a probe reading zero forever). It matters less than those did,
because the underlying balance turns out to be healthy — but a guard that
reports a two-element comparison as a met design goal is a guard that will not
notice when it stops being healthy.

**Fix.** Give the row a `judgeable` predicate requiring, say, ten traits over
`GUARD_MIN_SAMPLE`, and print the abstention line when it is not met. Separately,
run `METRICS_RUNS=1600` on push to `main` (§8.7) so the row is judged at a sample
that can judge it.

## 1.7 The authored-event ratchet has collapsed: two checks carry three different targets for one statistic

`validate-arenas.ts` and `check-flavor-pools.ts` both guard authored arena events
and disagree, in the same CI run:

| source | floor | target | verdict printed |
|---|---:|---:|---|
| `validate-arenas.ts` | 24 | **24** | `0 of 44 pack(s) under the target` |
| `check-flavor-pools.ts` header | — | **12** | `0 arena pack(s) under the target` |
| `check-flavor-pools.ts` body | 24 | **40** | `40 pack(s) under the soft target, 277 events to go` |
| `README.md` | 24 | 40 | describes the two as "separate numbers" |

In `validate-arenas.ts`, `AUTHORED_EVENT_FLOOR` and `AUTHORED_EVENT_TARGET` are
**both 24**. The file's own 25-line comment explains at length why they must be
two numbers — "the floor is a hard build failure and may only ever be raised;
the target is where the roster is going, and packs below it are counted" — and
then sets them equal, which makes `underTarget` structurally always empty and
the distance-to-go structurally always zero.

Two more staleness items fall out of the same block:

- The note hard-codes `of 44 pack(s)` while the roster is **45** arena packs plus
  4 procedural, and the loop iterates all 49.
- The printed "thinnest pack 24" is a **procedural** pack. The 45 hand-authored
  packs run 33–40. So the guarantee the floor actually makes for a hand-authored
  arena is 33, and any of the 45 could be trimmed by nine events without failing
  a build.

**Fix.** Set `AUTHORED_EVENT_TARGET = 40` in `validate-arenas.ts` to match the
number `check-flavor-pools` and the README both use, set `KNOWN_UNDER_TARGET` to
the measured 40, derive the denominator from the object being iterated, and
floor the hand-authored packs separately.

The last part matters more than it sounds, because of §1.8.

## 1.8 The four packs holding the floor down are unreachable at runtime — *proven*

`PROCEDURAL_FLAVOR_PACKS` is four packs of 24 events each — the four thinnest
packs in the game, and the reason `validate-arenas` prints "thinnest pack 24"
when the 45 hand-authored packs run 33–40.

They are also dead. `arenaFlavor()` reads:

```ts
if (arena && arenaId.startsWith('procedural-')) return withUniversalEvents(proceduralArenaFlavor(arena));
return withUniversalEvents(ARENA_FLAVOR[arenaId] ?? PROCEDURAL_FLAVOR_PACKS[arenaId] ?? GENERIC_ARENA_FLAVOR);
```

The `PROCEDURAL_FLAVOR_PACKS` lookup is reachable only when `arena` is
`undefined`. The declaration's own comment says so: *"These packs are only
reached when `arenaFlavor()` is called without the arena object."* Every call
site in the repository passes it:

```
src/engine/phases/dayNight.ts:158   arenaFlavor(ctx.state.arena.id, ctx.state.arena)
src/components/DossierPanel.tsx:153  arenaFlavor(gameState.arena.id, gameState.arena)
src/data/achievements.ts:1799/1805/1813  arenaFlavor(state.arena.id, state.arena)
```

So **96 authored events are served to nobody**, and they are simultaneously the
numbers dragging the roster-wide floor from 33 down to 24. Two problems from one
cause: dead content, and a ratchet calibrated against it.

Worse, the packs cover only four biome ids — `rainforest`, `volcanic`,
`archipelago`, `highlands` — while the generator produces **twelve**
(`PROCEDURAL_BIOME_COUNT = 12`: the four above plus tundra, dunes, bayou,
ruinlands, steppe, saltmarsh, boreal, badlands). Even on the dead path, two
thirds of the biomes would fall through to `GENERIC_ARENA_FLAVOR`.

**Fix.** Delete `PROCEDURAL_FLAVOR_PACKS`, or fold its 96 events into
`PROCEDURAL_BIOME_EVENTS` where the live path reads them. Then the thinnest
pack in the roster is 33, `AUTHORED_EVENT_FLOOR` can be raised to it, and the
ratchet in §1.7 starts measuring the content players actually meet.

## 1.9 Ratchets with permanent slack, and one guard that does not exist

Three smaller instrument problems, grouped because the remedy is the same shape.

- **`check-unnamed` has ±0.5pp of permanent give.** `KNOWN_SHARE = 0.040`; the
  check fails above 4.5% and advises tightening below 3.5%. The measured share
  is **4.3%** — passing, above the stated baseline, and inside a band where it
  can drift up 0.5pp per re-baseline indefinitely. Make the fail threshold the
  baseline itself and keep the slack only on the tightening side.
- **`test:decisions` does not guard its headline number.** It asserts trace
  presence, stance-in-top-three, stance-best and bottom-quintile destinations —
  and *not* destination-best, which is the number the README quotes. It has gone
  **72.8% → 63.7%** since AUDIT-6 with nothing failing. Stance-best has gone
  54.8% → 53.5% against a floor of 50%, which is closer to its guard than it has
  ever been. Add a destination-best floor and re-baseline both.
- **The tap-target census samples one screen.** `ui-test.mjs:711` navigates to
  the chronicle and counts controls there; the 119 it reports is not the
  interface, it is one page of it. See §2.1.

## 1.10 Thirteen `eslint-disable` directives in a project with no ESLint

`package.json` has no ESLint dependency, the repository has no ESLint config, and
`npm run lint` is `tsc --noEmit`. There are thirteen
`// eslint-disable-line react-hooks/exhaustive-deps` and
`// eslint-disable-next-line` comments across `App.tsx`, `GameScreen.tsx`,
`ChronicleScreen.tsx`, `EventFeed.tsx`, `DossierPanel.tsx` and
`StandingsTable.tsx`.

They suppress nothing. More to the point, the rule they name —
`react-hooks/exhaustive-deps` — is the one static check that catches a stale
closure in a hook, and this is a 13,798-line React interface with a
hand-rolled store, a router, an autosave, a rewind stack and a run-to-end loop.
Every one of those thirteen sites is a place a developer consciously decided to
lie to a linter that was not listening.

**Fix.** Add `eslint` with `eslint-plugin-react-hooks` and wire it into
`npm run lint`. Expect the thirteen disables to be mostly legitimate; the value
is the sites nobody flagged.

## 1.11 Risk register — not bugs, one edit away from being bugs

- `allianceCharter.ts:49` spreads `Math.min(...)` over a `flatMap` that is empty
  for a one-member group, yielding `Infinity`. Benign today because
  `assignRoles` already returns early under two members and alliances never form
  at one — but it is guarded by a caller rather than by itself.
- `Simulator.observe` explicitly documents that observers must not mutate state
  and that nothing enforces it. Every probe behind this report used it. A
  freezing wrapper in dev builds would make that guarantee real.
- `SetupScreen`'s randomiser uses `Math.random` for `enableHallucinations`,
  `enableBreakdowns` and three numeric dials. Correct — a config roll is not
  part of the seeded run — but it is the mechanism that makes §1.1 easy to hit,
  because a player who presses "surprise me" gets an unshareable config.

---

# §2 — All QOL, UI and UX updates needed

AUDIT-6 §2.1 called the absence of browser coverage in CI the QOL blocker. That
is closed: `test:ui` runs on every pull request as its own job and passes 51 of
51 steps, and `test:ui-affordances` and `test:unnamed` run beside it. The
interface is in better shape than any previous audit found it. What follows is
what the green roster does not cover.

## 2.1 Every control on the chronicle is under the tap-target minimum, and the census only looks at the chronicle

The harness reports, at 380px:

```
119 controls at 380px: 119 under 44px, 5 under 24px (ceiling 6)
```

**119 of 119.** Not most — all. The guard is on the 24px count only; the 44px
count is printed and never fails, and it has not moved off 100% since AUDIT-6
measured 168 of 168.

44px is the number the WCAG 2.2 target-size criterion and both platform HIGs
name. A hundred percent of controls under it is not a nit on a text-first game —
the chronicle is the primary reading surface, it has a filter row, a category
palette, a phase scrubber and a pager, and on a phone every one of those is a
target a thumb misses.

Compounding it: `ui-test.mjs:712` clicks through to the chronicle before taking
the census, so "119 controls" is *one screen*. The arena screen with its tab bar,
speed controls, Gamemaker booth and tribute tiles; the setup screen with its four
tabs, arena picker and slider bank; the Hall of Fame with its filters, compare
and transfer panels — none are measured. The real denominator is several times
119.

**Fix.** Raise the row height on the chronicle's controls to 44px (it is a
padding change, not a redesign — the 24px offenders are already inside the
ceiling). Then run the census on every screen the harness already visits and
report per screen, so the number means what its label says. Ratchet the 44px
count down the way the 24px count is ratcheted.

## 2.2 The five sanity dials cannot be shared, which is a UX bug before it is a correctness one

Stated in §1.1 as a correctness bug; it belongs here too and in its own terms.
The setup screen offers five controls — hallucinations, breakdowns, drain,
recovery, starting sanity — presented beside thirteen controls that *are*
shareable, with no visual distinction. A player tunes a run, likes it, presses
Share, and sends somebody a different run. There is no affordance anywhere that
tells them which settings travel.

**Fix.** Beyond §1.1's fix, put a one-line "this link carries every setting"
confirmation on the Share button, and — for settings that genuinely cannot
travel — mark them in the panel rather than leaving the player to find out.

## 2.3 There is no text-size or density preference

`Prefs` carries fifteen fields: units, palette (default / colourblind /
contrast), theme, spoiler-safe, coach marks, mute, four pause triggers, phase
pacing, reduce motion, shortcut hint, arena briefing, fullscreen. It is a
thoughtful set. It has no text scale.

This is a game whose primary output is **~926 log lines per run** read in a
four-column fixed-width layout. The colourblind and contrast palettes say the
project takes low-vision users seriously; a reader who needs 125% text has
nothing but browser zoom, which reflows the arena map and the chronicle's column
alignment. The `EventFeed` already has a `density` concept internally
(`EventFeed.tsx:535`) that is not exposed as a preference.

**Fix.** Two preferences, both cheap because the layout is already token-driven:
a `textScale` on `:root` (100 / 112 / 125%), and promote the feed's existing
`density` to a stored preference.

## 2.4 Keyboard shortcuts are rich and unremappable

The harness drives space, `m`, `o`, `x` and a further set, and correctly asserts
that they do not hijack typing in the chronicle search. There is a
`seenShortcutHint` preference and a command palette. There is no way to change a
binding, and no single place that lists them all — the coach mark shows some,
the palette shows others.

**Fix.** A shortcuts section in the settings panel that lists every binding and
lets it be reassigned, persisted in `Prefs`. The palette already has the
canonical command list to build it from.

## 2.5 Smaller items, each cheap

- **The Share button copies a link but not a summary.** A player sharing a run
  wants "Seed BRAVE-7, the Kiln, Marvel of 1 took it on day 12" in the clipboard
  alongside the URL. `ChronicleExport` already builds prose from the same state.
- **The picker knows what you have *seen* and not what you have *won*.**
  `arenasSeen` drives a "New to you" badge, a `unseen` facet and the featured
  arena — all present and working. `PanemRecords.arenasWon` is stored and read
  nowhere on the picker, so the one thing a returning player most wants to
  chase, an arena they have played and never taken, is invisible.
- **The saved-run slots have notes but no auto-label.** `setSlotNote` takes 120
  characters of free text; the default is empty. Seeding it with the phase, day
  and field size would make three slots legible at a glance.
- **The daily shows today and keeps yesterday.** `dailyBests` is keyed by seed
  and retains every past day; the setup screen reads exactly one entry,
  `dailyBests[todaySeed]`. A seven-day strip is a `.slice()` on data already on
  disk (§9.3).
- **The `spoilerSafe` preference has no counterpart for the arena briefing.** A
  player who wants the arena to be a surprise can hide outcomes but not the
  briefing's list of set pieces, which the picker prints before the run.

---

# §3 — Tribute logic: updates, robustness, more complexity

## 3.1 Decision quality has drifted down, and the number that drifted most is not guarded

Measured over 40 runs and 7,309 tribute-cycles:

| metric | AUDIT-6 | now | guard |
|---|---:|---:|---|
| trace present | — | 100.0% | ≥ 90% |
| stance held = best | 54.8% | **53.5%** | ≥ 50% |
| stance outside its own top three | — | **12.7%** | ≤ 15% |
| destination = best | 72.8% | **63.7%** | **none** |
| destination in bottom fifth | — | 1.7% | ≤ 15% |

Two of these are close to their guards and one has no guard at all. The
stance-rank histogram is `0: 53.5% / 1: 19.3% / 2: 14.5% / 3+: 12.7%` — so more
than one cycle in eight, a tribute is holding a stance their own scorer ranks
fourth or worse. Hysteresis is supposed to explain some of that; 12.7% against a
15% ceiling means hysteresis is explaining nearly all of the headroom.

**What to do.** Guard destination-best at 60% and re-baseline. Then look at the
`minHold` values in `STANCE_PROFILES`: the three **unconditional** stances all
hold for 3 cycles and are 80% of all stance-time (§3.3), so they are exactly the
incumbents a scorer would be ranking fourth while hysteresis keeps them in place.
Every conditional stance holds for 2 or fewer. Dropping the unconditional hold
to 2 is the one-line experiment that would tell you how much of the 12.7% is
hysteresis and how much is a scorer being ignored.

## 3.2 The objective queue is depth-1 and always has been

Stated as a bug in §1.3 with the proof; the design consequence belongs here.

The planning horizon the README advertises is *"an errand can be put in front of
a goal without discarding the goal"*. What the engine actually does is put an
errand in front of a goal, remember exactly one thing, and — because the queue
can never hold two — forget the goal the moment a second errand arrives. The
"standing goal" third slot (`resumeStandingGoal`) exists precisely because
somebody noticed that "a tribute who set out for the feast and stopped twice for
water simply forgot about the feast", and patched around the queue rather than
fixing it.

So there are two overlapping memory-of-intent systems, one of which is dead.
Fixing §1.3 makes the standing-goal slot do less work and makes the queue mean
what the balance knob says.

## 3.3 The stance roster is ten wide and the bottom half is 11% of all cycles

Measured over 250 runs, 53,380 living-tribute cycles:

```
Evasive    32.1%   Fortified   6.7%   Patrolling  1.8%
Defensive  24.2%   Hunting     3.4%   Nursing     1.7%
Aggressive 23.7%   Shadowing   2.8%   Scavenging  1.6%
                   Desperate   1.9%
```

The three unconditional stances are **80.0%** of all stance-time. The seven
conditional ones share 20%, and the bottom four share 7.0%. `test:metrics`
guards only "rarest stance share ≥ 1%", which every one of them clears.

This is an improvement on AUDIT-6 §3.1 (which found half the roster decorative),
and it is still a roster where adding an eleventh stance would land at roughly
1.5% of cycles. The constraint is not the scoring table — it is that the
preconditions are narrow and the three defaults are always legal.

**What to do.** Two structural changes rather than more stances:

- **Make one default conditional.** Evasive at 32% is the residual stance —
  where the scorer goes when nothing else qualifies. Gate it on *something*
  (cover available, or a known threat within two zones) and the 32% redistributes
  into Fortified, Shadowing and Patrolling, which are the stances that lose.
- **Keep widening preconditions the way AUDIT-6 did, and finish the job.**
  Nursing was 0.8% and is now 1.7% because AUDIT-6 §3.1 stopped it requiring a
  *formal alliance member* and let it read four relationships instead — an ally,
  a truce partner, a debtor, somebody you swore to protect. That doubled it, and
  it is still the second-rarest stance. The fifth case is the obvious one and is
  still missing: a tribute nursing **themselves** through a wound they are not
  going to survive on the move. Patrolling got the same treatment in the same
  pass and sits at 1.8%, against `zoneControl`'s 641 held zones per 400 runs —
  so both widenings worked and both stopped one case short.

## 3.4 Objective variety is top-heavy in the same shape

Same sweep, same 53,380 living-tribute cycles:

```
hunt 26.2%  reach 26.1%  survive 24.2%  protect 9.4%
flee 7.7%   hold 2.7%    stalk 2.6%     wait 1.0%
```

Three kinds are 76.5% of all objective-time; `wait` — an entire authored
behaviour with its own gates (`waitMaxFatigue`, `waitCycles`) and its own
flavour — is one cycle in a hundred. `hold` and `stalk` are under 3% each.

`stalk` and `wait` are the two objectives that create *tension without contact*,
which is the thing a text simulation is best at and the thing this one produces
least of. Their gates are the reason: `stalkHealth: 55` plus `stalkFear: 35` is a
narrow band, and `waitMaxFatigue: 60` excludes most of the mid-run field.

**What to do.** Widen the two gates and give each a second entry condition — a
`stalk` that a tribute *with* a health advantage takes because they want the
target somewhere else, and a `wait` that an alliance's `scout` role takes on
orders rather than on their own vitals. The second of those is also the first
real job for a role that currently has two read sites (§4.2).

## 3.5 Four of the fifteen proficiencies never leave the floor

Peak value reached by any tribute across 250 runs, against a cap of 6:

```
melee 6.00   crafting 5.85   ranged 5.67   persuasion 5.51   forage 5.22
climbing 5.20   swimming 4.98   tracking 4.90   butchery 4.19   medicine 4.06
oratory 3.59   navigation 2.53   intimidation 1.68   stealth 1.00   carpentry 1.00
```

`stealth` and `carpentry` peak at **1.00** — the starting value — across 6,000
tributes. Nothing in a run trains them. `intimidation` peaks at 1.68 and is also
the proficiency whose `TraitMod` has no writer (§1.4). `navigation` peaks at
2.53.

AUDIT-6 §3.3 reported eleven axes and a ceiling nobody reaches; there are
fifteen now and four of them are inert. An inert proficiency is worse than a
missing one, because `master-of-one` and the tribute sheet both present all
fifteen as things a tribute can be good at.

**What to do.** `trainProficiency` is already called from twenty-odd sites. Each
of the four needs one: a successful hide or an unnoticed move trains `stealth`;
building a shelter or a trap trains `carpentry` (it currently trains `crafting`,
which is why `crafting` is at 5.85 and `carpentry` at 1.00 — they are the same
verb split into two axes with one call site); crossing between zones without
backtracking trains `navigation`; and `intimidation` needs the trait writer from
§1.4 plus a training hook off a won standoff.

## 3.6 Robustness: what is solid and should not be touched

- **Decision traces are 100% present** across 7,309 cycles, with 1.1% forced.
  Nothing in this report would have been measurable without them.
- **Stance thrash is at 44% of cycles against a 60% threshold** and the bound has
  held across four audits.
- **Vitals, relationship magnitudes and zone depletion all stay inside their
  declared bounds** across 400 soak runs with no violations.
- **The condition/frame split is the best-modelled part of the tribute**, and the
  degradation path (Padded → Lean → Wasted) is doing real work: 4.2% of tributes
  end a run carrying an active infection and 3.5% carry scars.

---

# §4 — Tribute relationships and alliances

## 4.1 Two of the six social axes are effectively empty

Measured over 250 runs, 138,000 ordered tribute pairs, as the share of pairs
carrying any non-zero value:

| axis | fill | what reads it |
|---|---:|---|
| `respects` | **99.3%** | targeting order, whose report a group acts on |
| `relationships` (regard) | **61.8%** | everything |
| fear | **61.6%** | flight, stance, target choice |
| `sharedHistory` | 7.0% | reconciliation, backstory callbacks |
| **`memory.suspicion`** | **1.6%** | faction detection, pre-emptive betrayal |
| **`trusts`** | **1.0%** | truce durability, debt repayment |

`trusts` is the axis the README describes at length: *"'I don't like you any
more but I've come to trust you' is now a state the engine can hold."* It holds
it for one pair in a hundred. It was added "the way `respects` was" and
`respects` is at 99.3%.

`suspicion` at 1.6% is worse than a thin axis, because it is **load-bearing**.
`alliancePolitics.ts` detects factions by correlating per-pair suspicion; the
types.ts comment says so explicitly. A substrate that is empty for 98.4% of pairs
cannot correlate, which is the direct cause of §4.3.

**Fix.** Both axes have plenty of write sites in principle and almost no traffic
in practice. Audit what *should* move them — a kept truce term, a repaid debt and
a shared survival for `trusts`; an unexplained absence, a contested cache draw,
an ally seen talking to a rival for `suspicion` — and check each one fires. The
cheap diagnostic is a counter per write site in the soak; the ones reading zero
are the bug.

## 4.2 Two of the eight alliance roles are unreachable and read by nothing — *proven*

`assignRoles` (`alliance.ts:188-213`) orders eight jobs and fills
`min(jobs.length, members.length)` of them, so role *n* requires a group of
*n+1*. Measured over 250 runs, 7,680 live alliance samples, 23,679 filled
role-slots:

```
muscle 7,216 (30.5%)   quartermaster 3,089 (13.0%)   watch  1,314 (5.5%)
medic  6,847 (28.9%)   face          2,027 ( 8.6%)   runner     0
scout  3,186 (13.5%)                                 keeper     0
```

- **`runner`** is index 6, so it needs **7 members**. Groups of 7 occur in 10 of
  8,337 alliance samples in `test:metrics` (0.1%) and in none of the 7,680 here.
- **`keeper`** is index 7, so it needs **8 members**. `ALLIANCES.maxSize` is 6
  and `grandCoalitionExtra` is 2, so 8 is the absolute ceiling of the game and
  the soak's largest group ever observed is 7. It is reachable only at the
  theoretical maximum size, which no measured run has produced.

Both are also **read by nothing**. Grepping every role name outside the
assignment table:

```
quartermaster 10   medic 10   scout 2   muscle 1   face 1   watch 1   runner 0   keeper 0
```

`types.ts:1511-1515` states what they are for: *"`runner` carries the cache.
`contributeToCache` had no owner at all… `keeper` holds the group's debts, which
`debts.ts` tracked per-person with nobody responsible for them."* Neither
sentence is implemented. The cache still has no owner and debts still have no
keeper.

**Fix.** Two changes, independent of each other. Move `runner` and `keeper`
earlier in the `jobs` array so they are reachable at groups of four and five —
the ordering comment says the list is "ordered by how much the group notices
losing them", and a group that loses the person holding its debts notices more
than one that loses its face. Then give each one read site: `runner` owns
`contributeToCache` and loses the cache on death the way `quartermaster` does
(`combat.ts:1707` is the pattern), and `keeper` gates `debts.ts` repayment.

## 4.3 Alliance politics is still near-dead, and §4.1 says why

Measured over 400 soak runs:

```
politics: factionActions=13   expulsions=139   hearings=11
```

Thirteen faction actions and eleven hearings across four hundred complete Games.
11.5% of alliance samples carry a `factions` array at all. AUDIT-6 §4.4 made the
same finding; the causal chain is now visible and it is not in
`alliancePolitics.ts`:

```
suspicion fills 1.6% of pairs  →  no two members' suspicion of a third correlates
                               →  no faction is detected
                               →  no coup, no walk-out, 13 actions in 400 runs
```

Fixing `alliancePolitics` directly would be fixing the wrong file. Fix §4.1's
suspicion fill and this recovers for free; then re-measure before touching the
faction thresholds.

## 4.4 Succession names no heir in half of all groups

```
succession: toNamedHeir=97  heirPassedOver=20  splitTheGroup=11  noHeirNamed=104
```

46.7% of live alliance samples carry a `successorId`; 104 of 232 leadership
transitions happen with no named heir at all. The comment on `successorId` says
a named heir "makes killing the leader a different calculation" — and it does,
for half the groups.

The pattern is the same as §4.2: the feature exists, works, and is gated on a
group size or a condition that half the field never meets.

**Fix.** Name an heir at charter time rather than lazily, for every group of
three or more. An heir who is later passed over is a better story than no heir.

## 4.5 The bloc-treaty layer ends 80% of its treaties by attrition

```
blocTreaties: sworn=253  brokenByAKilling=4  lapsed=17  endedByTheField=3
              outlivedASide=204  narratedEndings=228
```

253 treaties sworn across 400 runs, of which **204 (80.6%)** end because one
side stopped existing. Four are broken by a killing. AUDIT-6 §4.3 found 153 of
167 ending silently and fixed the narration — 228 of 253 now get an ending line.
What it did not change is that a treaty between two alliances is a thing that
gets outlived rather than a thing anybody decides about.

**Fix.** Give a treaty a term and a renewal beat, the way `truceLedger` already
does for two people (its ledger shows `renewed=199` against `lapsed=195` — a
healthy split). A bloc treaty that comes up for renewal while both sides are
still standing is a decision; one that expires with its counterparty is
bookkeeping.

## 4.6 What is working and should not be touched

- **The truce ledger reconciles exactly**: 970 terms, 970 accounted endings, 0
  unaccounted, across eight ending kinds. So do the vengeance ledger (397/397)
  and the loan ledger (442 made, 441 accounted).
- **Reconciliation is the busiest social system in the game** at 1,172 events per
  400 runs, and it was the one AUDIT-5 added.
- **Charter clauses are well spread** after the AUDIT-6 reweighting: 1,866 down
  to 1,046 across eight clauses, against the near-uniform 833–558 before.
- **Alliance naming and camps are universal** — 100% of non-lovers groups carry
  both a brand and a camp zone.

---

# §5 — Arena updates, robustness, more complexity

## 5.1 The authored layer is complete, and that is the finding

For the first time, every structural coverage row in `test:arenas` reads 45/45 or
better:

```
own event pack 45/45   effectVocab 45/45   restockBias 45/45
cornucopiaLayout 45/45   off-season skins 45/45 (135 definitions)
arenas on the universal Gamemaker pack: 0 (ceiling 0)
arenas that can produce a death of their own: 45/45
zones carrying an authored interior: 470/470
a water source: 42/45 — missing: frozen, warren, silkwood
```

AUDIT-6 §5.1's lattice-with-holes and §5.2's shared-Gamemaker-roster findings are
both closed. The three waterless arenas are deliberate (a frozen waste, a burrow
and a spider wood), and §7.3 below treats the mechanical consequence.

What is left is depth rather than coverage, and the numbers below are all about
density.

## 5.2 84% of the map is plain adjacency

Across the 45 arenas: **641 undirected edges, 103 edge rules — 16.1%.** Every
arena carries at least one, which is the improvement since AUDIT-5; eleven carry
exactly one. The seven kinds are spread `tolled 28, contested 25, hidden 15,
collapsing 13, timeGated 9, oneWayAfter 8, oneWay 5`, against a floor of 4 per
kind.

The map's mechanical vocabulary is broad and thinly applied: a tribute crossing
a typical arena passes through six or seven connections and meets a rule on one
of them. The `garrisonedEdges` system — an alliance holding a contested
crossing — fires in 53 of 400 runs.

**What to do.** Raise the per-arena floor from 1 to 3 and author to it. The
cheapest wins are `tolled` and `timeGated`, because both are pure data and both
interact with systems already running (`parley` for a toll, the day/night clock
for a gate). A contested edge per arena would roughly triple garrison runs.

## 5.3 Two statistics disagree about which zone effects matter, and neither is guarded

Live instances sampled per cycle, 400 soak runs:

```
fogbound 1,799   stripped 1,149   flooded 1,068   burning 899   contaminated 722
blooming 536     swarming 176     frozen 143      quaking 128   irradiated 119
```

And the events that *cause* them, from the same sweep:

```
zoneFires 28 (spread 136)   floods 110   freezes 23   contaminations 11
fogs 12   strippedZones 101   severed 14
```

The two tables disagree, and the disagreement is the finding. **Twelve fog
events across four hundred Games produce the most common live effect in the
sweep**, because fog is long-lived; twenty-eight fires produce less than half as
much live burning, because fire resolves. So "how often does this happen" and
"how much of the arena is in this state" are 150x apart for one effect and
roughly 30x for another, and a reader of either number alone will draw the wrong
conclusion about which effects are doing work.

`test:sim` guards neither. It asserts only that each of the ten kinds occurs at
least once across the sweep, which every one of them clears comfortably.

The instance table's own spread is **15:1** (fogbound 1,799 to irradiated 119),
and the bottom four — swarming 176, frozen 143, quaking 128, irradiated 119 —
are within 1.5x of each other, so there is no single starved effect. The trigger
table is the lopsided one: contaminations at 11 and freezes at 23 per 400 runs
are one every thirty and one every seventeen Games.

**What to do.** Guard both tables, not one: a per-kind floor on *instances* (no
kind under 2% of the total) and a per-kind floor on *triggers* (no cause under
one firing per twenty runs). Then give `contaminated`, `frozen` and `irradiated`
a second authored trigger each — all three currently have roughly one arena that
can produce them.

## 5.4 A run shows about a third of its arena's authored pack

Measured over 250 runs at the default config, counting distinct authored event
ids stamped into `eventLastFired`:

```
authored arena events fired per run: min 2, p50 12, mean 12.5, max 40
```

Against a mean pack of 34 events, that is **37% per run** — good, and much better
than the soak's 5.3 figure, which sweeps two- and three-district configs that end
in four days. The `min 2` is the same short-config artefact.

The weaker number is chain and reactivity density:

```
1,523 authored arena events across 45 packs
  gated on state (requires):  228  (15.0%)
  oncePerRun:                 191  (12.5%, 4.2 per arena)
  chained (a setup with a follow-up): 45
  chains-per-arena distribution: {1: 45}
  state-gated per arena: 2 (clockwork, concrete, seapeaks) … 14 (vigil, kiln)
```

**Exactly one chain per arena, in all 45** — the distribution is literally
`{1: 45}`, not a mean that happens to land on one. The state-gated count, by
contrast, is genuinely spread: 2 to 14, a 7x range, which is what an
authored-to-taste number looks like. That is the authored-to-the-floor
signature this project has caught three times before (§10.2): a floor of one,
met precisely, forty-five times. A chain is the single most distinctive thing an
arena event can be — it is the only construct that makes a run's events refer to
each other — and it is the rarest.

**What to do.** Raise the chain floor to 3 and the state-gated share to 25%. Both
are pure data and both are checked by machinery that already exists in
`validate-arenas.ts`.

## 5.5 Robustness: what is solid

- **Every distinct stacked-law combination in the roster plays to completion**
  and is asserted to have been in force — 17 combinations, 9 to 17 days each.
- **Zone graphs are connected and symmetric** across all 45.
- **Every terrain is covered by at least one mutt that can appear on it**, so
  there are no permanently mutt-free zones.
- **Mutt roster reach is 100%** — 187 of 187 named in a line across six runs of
  each arena sampled.
- **Off-season skins now run in every headless harness** after AUDIT-6's
  `arenaSetup` hoist; 71 of 400 runs are skinned and 49 of 135 skins were seen.
  The remaining 86 are a runs-per-skin artefact, not a coverage hole — 135 skins
  across 400 runs at a 17.8% skin rate is 0.5 runs per skin.

---

# §6 — Small and side features: updates, robustness, complexity

## 6.1 Legendary weapons work and the player still cannot see it

Measured over 250 runs, sampling **live inventories** rather than end states:

```
runs producing at least one named weapon: 81.6%
arena cycles with a named weapon in play: 47.3%
distinct names minted: 148  (Ninth Hour, The Argument, Last Tuesday, Anthem,
                             The Short Way, Quiet Sunday, Threadbare, Widow's Reach…)
```

The system is healthy. AUDIT-6 §6.2's finding was that nothing surfaces it, and
that half is unchanged: a named weapon has no marker in the roster, no entry in
the record book, and no line when it changes hands. Four in five runs mint a
proper noun the game never introduces.

**Fix.** A one-line feed entry when a weapon earns its name and another when it
is taken off a body; a marker on the tribute tile; and `PanemRecords` already has
the shape for a cross-run "weapons that outlived their owners" list.

## 6.2 Fieldcraft's trap kinds are 14:1 apart

```
traps by kind: deadfall 406   pit 363   snare 196   tripwire 114   stake 28
trapsSet 1,107   trapsTriggered 302  (27.3%)
```

Five kinds, and the fifth fires **28 times across 400 Games** — one every
fourteen runs. `tripwire` at 114 is not much better. AUDIT-6 §6.3 added the two
kinds that are now at the bottom, and they arrived under-weighted.

The trigger rate is the more interesting number: **72.7% of traps set are never
triggered.** A trap is a bet on somebody else's movement and three quarters of
them lose, which is plausible — but nothing anywhere tells the tribute who set it,
so a tribute who has set six traps that all failed sets a seventh.

**Fix.** Reweight `stake` and `tripwire` to parity with `snare`. Then record
trap outcomes in `objectiveOutcomes` the way hunts already are
(`OBJECTIVES.sameTargetPenalty` is the pattern), so a tribute whose trapping has
not paid off does something else.

## 6.3 Rumours: the plant/expose economy is one-sided

```
rumours planted 191   exposedAsPlant 95 (49.7%)   exposedAsRepeated 45   untraceable 60
true claims by kind: holed-up 413   cache 121   empty 96   restock 49
```

Half of all planted rumours are exposed. That is a *very* high detection rate for
a deception system, and it means planting is close to a losing move: 191 plants
bought 96 uncaught lies at the cost of 95 reputations.

Separately, the four true-claim kinds are 8:1 apart — `holed-up` at 413 against
`restock` at 49 — so the lure kinds AUDIT-3 §1.3 identified are still the thin
ones.

**Fix.** Halve the exposure chance and make exposure scale with the planter's
`rumourCredibility` (a `TraitMod` carried by exactly one trait — see §12.3).
Raise `restock` and `cache` true-source frequency so a lure is sometimes worth
following.

## 6.4 Bluffs and standoffs are rare enough to be invisible

```
bluffs: landed 85  caught 91        parley: standoffs 79   paidInInformation 38
resolve: breakdowns 133  nightlock 34
```

Eighty-five successful bluffs across 400 runs is one every five Games. A player
who plays ten runs will see two. `paidInInformation` — paying a toll in intel
rather than goods, which is one of the more distinctive things `parley` can do —
fires 38 times, under one per ten runs.

**Fix.** These are gated systems whose gates are tuned for an eight-day run and
the run is now eleven. Widen the entry conditions rather than the outcome odds:
a standoff should be reachable whenever two tributes meet and neither has a
decisive advantage, which is common, rather than only under the current
narrower state.

## 6.5 Items: 70 objects and the distribution is still weapon-heavy

70 distinct items ever held across 250 runs. The fifteen most-held are **eleven
weapons** (Sharpened Stone, Trident, Bow and Arrows, Sword, Spear, Axe, Mace,
Machete, Sickle, Length of Rebar, Blowgun with Darts) and **four consumables**
(Purification Tablets, Iodine Drops, Antidote Vial, Antivenom Ampoule). No tool,
no clothing, no container and no light source appears in the top fifteen at all.

AUDIT-6 §6.5 added twelve items with read sites and the shape did not change,
because the bloodbath and the cornucopia restock both draw weapon-weighted — the
roster grew and the *draw* did not.

**Fix.** The lever is `cornucopiaLayout` and the restock bias, both of which are
authored per arena (45/45). A tool-heavy or medicine-heavy horn in five or six
arenas would differentiate them from each other as well as fixing the mix.

## 6.6 Side systems that are working

- **Zone control**: 641 holds and 151 payouts per 400 runs — a real economy.
- **Abandoned camps, weather fronts and the muster** all fire at healthy rates
  (597 fronts, 189 musters in 400 runs, attended in 170).
- **The debt and loan layer reconciles exactly** (§4.6) and defaults are rare
  enough (31 of 442) to mean something.
- **Infection is the best-tuned of the newer systems**: 398 wounds turn, 160
  deepen, 182 are treated, 35 reach terminal and 23 kill — a funnel with a
  survivable shape at every stage.

---

# §7 — More ways to die, and more events

## 7.1 The death table, measured

400 runs, 7,239 deaths (`test:metrics`), cross-checked against 250 runs and
5,746 deaths (probe 3):

```
tribute        58.3%      burns        3.5%
arena/hazard   13.2%      infection    3.4%
bleeding        5.4%      frostbite    2.7%
poison          5.1%      dehydration  2.5%
mutts           4.9%      starvation   0.5%
                          border       0.4%
```

Every guard holds: tribute kills ≥33%, mutts-and-hazards inside 5–20%, untreated
bleeding ≤13%. The shape is good and this section is not asking for it to change.

What the table hides is that **`starvation` and `border` together are 0.9%** —
61 deaths in 400 Games, or one every six or seven runs between them. Starvation
in particular is a headline threat in the fiction and a rounding error in the
simulation: 34 deaths in 400 Games, against 183 from dehydration and 958 from
the arena. A run is now eleven days long — long enough for hunger to be a real
clock — and it kills one tribute in every twelve runs.

## 7.2 The universal death vocabulary: 61 causes, and the non-combat half is thin

`UNIVERSAL_EVENTS` carries 88 events, **49 of which can damage (55.7%)**, across
61 distinct causes of death. They are the deaths that can happen in any arena,
and they are what a player meets in an arena whose own pack has not come up.

The gaps, by category:

- **Nothing kills by thirst-driven error.** The pool has three drowning causes
  and two water-poisoning ones, and none of the five is gated on thirst — there
  is no "drank from the wrong place because they had not drunk in three days",
  which is the commonest real death in survival literature and which
  `vitals.thirst` already tracks precisely enough to gate.
- **Nothing kills by a failed alliance act.** 88 events and none of them is
  "died covering somebody's retreat", "died going back for them", or "died of a
  wound taken for somebody else". `bledOutDuringARescue` exists as an engine
  cause (15 occurrences) with no authored event behind it.
- **Nothing kills by the body's own failure.** No heart, no seizure, no allergic
  shock beyond one entry, no death from the accumulated `conditionPressure` the
  physique model already computes. A tribute who has walked Padded → Lean →
  Wasted can starve, but cannot simply stop.
- **Nothing kills by equipment.** 70 items, and no death from a snapped rope on a
  climb, a weapon that failed at the wrong moment, or armour that would not come
  off in water.

### Twenty universal deaths to add

Each one is a `UNIVERSAL_EVENTS` row with a `cause`, a `damage`, a `dodgeStat`
and text — no new mechanics, and each is gated on state the engine already holds.

| cause | gate the engine already has |
|---|---|
| Drank from standing water they knew was bad | `vitals.thirst > 85` |
| Ate the second thing after the first one turned | `woundInfection` or prior poison |
| Died covering a retreat | ally in zone, `objective.kind === 'protect'` |
| Went back for somebody and did not come out | `relationships[x] > 60`, ally downed |
| Bled out from a wound taken for somebody else | `bleedOpenedById !== killerId` |
| The body simply stopped | `condition === 'Wasted'` and `daysSurvived > 8` |
| Heart gave out on the climb | `vertical` zone, `fatigue > 85` |
| Seizure at the sanity floor | `vitals.sanity < 10` |
| Rope parted on the descent | carrying rope, `vertical` zone |
| Weapon broke in the wrong exchange | `weapon.quality === 'poor'`, mid-combat |
| Drowned under the weight of what they carried | `carryCapacity` exceeded, water zone |
| Froze because the fire would not take | `fireImpossible` law or wet fuel |
| Killed by the cold after the shelter failed | `campSkill` roll failed, night |
| Walked off an edge in the dark | `noNight`-less arena, `awarenessNight` low |
| Caught in their own trap in the dark | `traps` set by self in current zone |
| Poisoned by their own poisoned weapon | `poisonedWeapons` set, wound to hand |
| Died of a fever nobody could name | `woundInfection` terminal, no medic present |
| Starved within reach of food | `zoneDepletion` low, `hunger > 92` |
| Crushed by what they were sheltering under | `shelter` feature, `loadBearing` high |
| Killed by the silence | `sanity < 20`, no sighting for 4+ cycles |

## 7.3 Arena-specific deaths: 1,246 causes, and the density is uneven

45 packs, 1,523 authored events, **1,117 of which can damage (73.3%)**, across
**1,246 distinct arena-specific causes of death**. Only 10 duplicate a universal
cause, so the arena layer really is speaking in its own voice.

Lethal causes per arena:

```
thinnest: labyrinth 17, nooneplace 18, kelvin 20, storywood 20, silkwood 22, karst 23
thickest: vigil 39, tidewrack 38, thresher 38
```

A 2.3x spread between the thinnest and thickest arena's death vocabulary. The six
thinnest are — with the exception of the labyrinth — the six most recently
authored, which is the usual pattern.

Three arenas have **no water source** (`frozen`, `warren`, `silkwood`), which
`validate-arenas` reports as a note. That is a design choice, and it means those
three arenas' dehydration deaths come from the universal pool rather than their
own. Each should have two authored thirst deaths in its own idiom — dying of
thirst in a frozen waste surrounded by ice you cannot melt is the arena's whole
thesis, and it is currently narrated in the shared voice.

### Arena-specific deaths to add, by arena

Twelve, for the six thinnest packs and the three waterless ones:

- **labyrinth** — took a turn they had already taken; the hedge closed behind them; died of thirst inside a green place.
- **nooneplace** — answered to a name that was not theirs; walked into a room that was not there yesterday.
- **kelvin** — the station's own atmosphere; sealed on the wrong side of a bulkhead.
- **storywood** — the ending somebody else had already written; taken by the thing in the second verse.
- **silkwood** — wrapped and kept; died of thirst with dew on every strand above them.
- **karst** — the water table rose while they slept; a passage that only goes one way.
- **frozen** — ate snow and died of it; the ice they were standing on was the water they needed.
- **warren** — drowned in a flooded run; died of thirst two tunnels from a seep.

## 7.4 More events: universal

88 universal events, 39 of which are non-lethal beats. Relative to a run that
generates ~926 log lines, the universal layer is the thing a player sees most
often and it is the smallest pool in the game. The four categories with no
universal representation at all:

- **Events about time.** Nothing marks the anniversary of a death, the fourth day
  in one zone, or the first night somebody sleeps properly. The engine holds
  `daysSurvived`, `dayOfDeath` and `sleepDebt` and narrates none of them.
- **Events about being watched.** `audience.ts` computes excitement and
  `notoriety.ts` computes fame; no universal event is about a tribute realising
  they are a favourite, or that they are not.
- **Events about objects.** 70 items, 148 named weapons per 250 runs, and no
  universal event where an object is the subject — a canteen that runs dry, a
  pack that splits, a coat that finally dries.
- **Events about the dead.** 298 haunted and 367 hollow states per 400 runs, and
  the universal pool has no event that fires *because* of them.

Thirty universal events across those four categories, all reading state that
already exists, would roughly double the layer a player meets most.

## 7.5 More events: arena-specific

The structural gaps, from §5.4, restated as authoring work:

- **Chains: 45 across 45 arenas — exactly one each.** Raise to three. A chain is
  the only event construct that makes a run's events refer to each other.
- **State-gated events: 228 of 1,523 (15%).** Raise to 25%. The gates that exist
  (`after dark`, `in a storm`, `field down to four`) are used; the ones that are
  not are `law`, `zoneEffect`, `allianceSize` and `dayRange`, all of which
  `ArenaEvent.requires` already supports.
- **Once-per-run: 191, 4.2 per arena, floor 2.** Healthy; six arenas sit at
  three. The `every-door` achievement needs a pack with enough of them to be
  worth chasing (§11.2).

---

# §8 — Trait and archetype balancing

## 8.1 The trait balance is fine; the guard that reports it is broken at the run count CI uses

Stated as an instrument bug in §1.6. Measuring it properly changes the balance
conclusion, so both halves are set out here.

**At n=1,600 — the honest measurement — reaping-trait balance is good.** 99
reaping-assigned traits, 50 of them clearing `GUARD_MIN_SAMPLE`:

```
guarded spread (n >= 500):  Hydrophilic 7.56% (n=701)  →  Skittish 3.44% (n=640)   2.20x
raw spread (all 99):        Hydrophilic 7.56%          →  Witness    2.29% (n=131)  3.30x
```

2.20x against a `<= 2.5` design goal, and 3.30x across the whole table with the
tail sitting on samples of 131–444. Only three traits draw under 300 entrants.
There is no trait-balance crisis.

**At n=400 — the run count CI actually uses — the same row is meaningless and
says so in green.** Only two reaping traits clear 500 entrants at 400 runs:
Charismatic (n=501, 5.79%) and Trapper (n=728, 4.81%). The indicator prints:

```
PASS  reaping-trait win spread (best/worst)   1.20x   (guard <= 4.5  goal <= 2.5 MET)
```

5.79 / 4.81 = 1.204. **The row is a two-element comparison reporting a verdict.**
Meanwhile the raw 400-run table shows Eagle-Eyed at 9.70% (n=268) and Needy at
0.86% (n=116) — an 11.3x spread that is one victor in 116 and is sampling noise,
not signal: the same Needy trait is nowhere near the bottom at 1,600.

So the CI row is wrong in both directions at once — the number it prints (1.20x)
is unrelated to the real one (2.20x), and the raw table beside it invites a
reader to a conclusion (11.3x) that does not survive a bigger sample. The
archetype rows immediately above handle the identical situation correctly, with a
`judgeable` predicate that prints *"no population over 500 entrants at this run
count — reported, not guarded"*. The trait row has no such predicate.

**What to do.**
1. Give the row a `judgeable` predicate — at least ten traits over
   `GUARD_MIN_SAMPLE` — so it abstains at 400 runs the way its neighbours do.
2. Run `METRICS_RUNS=1600` on merge to `main` (not per pull request; it takes
   several minutes) so the archetype and trait rows are judged at a sample that
   can judge them.
3. The remaining balance work is the tail, not the spread: `Witness` (2.29%,
   n=131), `Hard Bargain` (3.38%), `Skittish` (3.44%) and `Lightfooted` (3.46%)
   are the four lowest and are all one- or two-modifier traits against a roster
   median of four.

## 8.2 Three archetype signatures fire under 25%, and the roster's own report says so

Share of entrants whose set piece fired, n=1,600:

```
survivalist 60.4%   …   opportunist 42.5%   beast 42.4%   zealot 42.4%
confessor 39.1%   duellist 38.2%   bellwether 33.3%   captor 30.4%
warden 24.3%   broker 24.2%   quartermaster 19.8%
spread: survivalist 60.4% vs quartermaster 19.8%        (3.05x)
```

`metrics.ts` prints that spread line itself and does not guard it. AUDIT-6
reported all fifteen archetypes then in the roster firing between 39% and 59%;
the roster has since doubled to 29 and the new bottom four are all below the old
floor.

An archetype's signature is the once-per-run set piece that makes it a character
rather than four bias scalars. A quartermaster who does their thing in one run of
five is, four runs in five, an ordinary tribute with a preference.

The bottom four share a cause worth checking before retuning: `warden`, `broker`
and `quartermaster` are all **alliance-dependent** signatures, and `captor` needs
a live prisoner. This is adjacent to §4.2 — `quartermaster` the *role* is filled
13.0% of the time and `quartermaster` the *archetype* fires 19.8% of the time.

**What to do.** Give the three alliance-dependent signatures a second trigger a
soloist can reach — a quartermaster hoarding for themselves is the same set
piece — and add a floor to `test:metrics`: no archetype signature under 30%.

## 8.3 Archetype win spread is 2.36x against a goal of 2.3x — the closest it has ever been

At n=1,600, where all 29 archetypes clear `GUARD_MIN_SAMPLE`:

```
PASS  archetype win-rate spread (best/worst)   2.36x   (was 4.6, guard <= 3.4, goal <= 2.3 unmet)
PASS  worst archetype win rate                 3.01%   (was 2.56%, guard >= 2.6%, goal >= 3.5% unmet)
PASS  best archetype win rate                  7.11%   (was 11.8%, guard <= 10.2%, goal <= 8%  MET)

best   career    7.11%  (n=1968)
worst  penitent  3.01%  (n=930)
bottom five: tracker 3.89, saboteur 3.78, herald 3.75, martyr 3.57, penitent 3.01
```

This is the strongest archetype balance any audit has measured — down from 4.6x,
with the best-rate goal met and the spread 0.06 off its goal. Two notes:

- **The worst archetype is `penitent`, not `herald`.** At 400 runs herald reads
  2.53% and looks like the floor; at 1,600 it is 3.75% and mid-pack. This is the
  same sampling trap as §8.1 and the reason the 400-run rows abstain.
- **`penitent` at 3.01% is 0.58x the field mean** and is the one archetype worth
  looking at directly. Its signature fires at a healthy rate, so the deficit is in
  its bias set rather than its set piece.

## 8.4 District legacy is a real and stable handicap

```
strong     8.6%  (275 of 3,200 entrants)
storied    7.9%  (507 of 6,400)
modest     4.4%  (178 of 4,030)
forgotten  4.0%  (262 of 6,530)
thin       3.6%  (376 of 10,460)
```

**2.4x from `strong` to `thin`**, and a clean monotonic ladder. AUDIT-6 §8.5
established that this is the finding that survives (its per-district numbers were
wrong and were corrected there); the tier spread has barely moved since, which is
the point — it is a deliberate handicap, and 3.6% is not unwinnable. Career
victors at 48.9% against a `<= 45%` goal is the same story from the other end:
guarded, passing, short of goal.

Nothing here needs fixing. It is recorded so the next audit does not rediscover
it as a problem.

## 8.5 Two archetypes still declare no antipathies

```
missing hatesArchetypes: herald, forager
```

Of the seven declared archetype fields, `hatesArchetypes` is the only one with
gaps, and it is down from AUDIT-6's larger set. Both remaining gaps are
meaningful, because `hatesArchetypes` feeds targeting: an archetype nobody is
drawn to fight is an archetype that never gets a fight on its own terms. A herald
with no antipathy in particular has nothing to be a herald *against*.

**Fix.** `herald` hates `confessor` and `zealot` (three ways of claiming to speak
for something); `forager` hates `scavenger` (the same niche, one of them honest).

## 8.6 Trait power-level outliers

The trait-power report — a proxy for power, published as a report rather than a
guard — flags:

```
combat    n=42  mean 0.85 sd 0.76   hot: Hardened 3.45 (3.4sd), Unremarkable 2.92 (2.7sd), Ruthless 2.00 (1.5sd)
social    n=26  mean 0.93 sd 0.54   hot: Quiet Room 2.50 (2.9sd), Barterer 1.80   cold: Vouched 0.10 (-1.5sd)
survival  n=43  mean 0.84 sd 0.55   hot: Waterborn 2.54 (3.1sd), Broken 2.00, Stoic 1.75, Devout 1.70, Hydrophilic 1.70, Fragile 1.70
```

Three observations the report does not draw:

- **`Hardened` at 3.45 is the highest-magnitude trait in the game and its holders
  win 2.91% of the time** — the second-lowest of any earned trait. That is the
  clearest case in the table of magnitude not being power: Hardened is *earned*
  by surviving something that usually kills you, so its win rate is survivorship
  running the other way. The report's own header says earned traits measure
  survivorship; it does not say that the magnitude column and the win-rate column
  are therefore not comparable for them, and a reader will compare them.
- **The combat category has 42 numeric modifiers against social's 26.** AUDIT-6
  §12.2 set out to close that gap and narrowed it from 26:8 to 42:26. The social
  half is still the thinner one, and §8.1's four lowest-winning traits are all
  one- or two-modifier rows. Adding keys was the right move; the values on them
  are small.
- **`intimidation` is declared in the social family and carried by no trait at
  all** (§1.4), so the social category is 26 modifiers spread across 58 live keys.

## 8.7 Run the 1,600-run pass where it can change a decision

Every judgeable number in this section came from `METRICS_RUNS=1600`, and every
misleading one came from the 400-run pass CI runs. The two rows that abstain at
400 runs (archetype best/worst) and the one that does not abstain and should
(§8.1's trait spread) are all artefacts of the same gap.

**Fix.** Add a 1,600-run `test:metrics` job on push to `main` only — it takes a
few minutes and nothing about a pull request needs it. That is the change that
lets the archetype guards move from "reported, not guarded" to guarded, which is
the only route by which the `<= 2.3x` goal ever becomes enforceable.

---

# §9 — Replayability, and not going stale

## 9.1 The variance problem is solved; the *visibility* of variance is not

Run length is now **11.0 days at n=400 with a 2.69-day standard deviation**,
inside the 10–13 guard and meeting the 10.5–12 design goal. AUDIT-6's headline
finding is closed.

The draw layer underneath is genuinely wide:

```
temperaments:  9, evenly drawn (17–34 occurrences in 250 runs)
cast shapes:   8, from 'ordinary' (26%) to 'victors-field' (1.6%)
Quells:        28 defined, 27 seen in 600 draws, rate 24.3%
wildcards:     27 in the ordinary pool, all 27 drawn; 13 more Quell-only
mutators:      12
off-season skins: 135 across 45 arenas, 17.8% of runs
arenas:        45 authored + a generator covering 12 biomes
```

A player cannot exhaust this, and more of it is on screen than a first pass
suggests. `DossierPanel.tsx:610-625` carries a live line — *"the 47th Games —
attrition, with a bounty on day 6"* — plus the Head Gamemaker and a
`fired/total` counter for the arena's once-only events. That is the right idea,
already built.

Two draws are missing from it, and they are the two with the largest mechanical
reach:

- **The cast shape** — eight of them, from `ordinary` (26% of runs) to
  `victors-field` (1.6%) — decides who is in the arena at all. It is announced at
  the reaping and never named again.
- **The off-season skin** — 135 definitions, firing in **17.8% of runs**, able to
  lift the arena's law, impose a different one, and change what the ground yields
  and costs — is named by **no component or screen in the repository**. A grep
  for `skin` across `src/components` and `src/screens` returns nothing but the
  word "asking". One run in six is played on materially different ground with no
  marker anywhere that it is.

**Fix.** Two more clauses on a line that already exists, and — for the skin — a
marker beside the arena name, because "the Kiln, in the off-season" is a
different arena from "the Kiln".

## 9.2 The cross-run layer is deep, mostly surfaced, and missing the one hook that drives a *re*-play

`PanemRecords` carries twenty-six fields: runs, victors, unlocked achievements
and their unlock run, patron districts, arenas bought, stipends, daily bests,
victor mentors, records, arenas won, Gamemaker records, district crowns, Quells
seen, laws won under, biomes won, mutts seen, arenas seen, deaths seen, events
seen, patron wins, heirlooms, recent runs, and a Head Gamemaker with a term.

Most of it is surfaced, and this section was originally written claiming
otherwise. `PanemRecordBook` renders the collection state — Mutts *n*/216, Ways
to die *n*/total, Arena events *n*/total — and the setup screen's arena picker
reads `arenasSeen` for a "New to you" badge, a `unseen` facet filter and the
rotating featured arena. That is a good meta-game with a real surface.

What is missing is narrower and more useful than "surface it all":

- **`arenasWon` is stored and read nowhere on the picker.** "Seen" and "won" are
  different states and the second is the one that pulls a player back. An arena
  played three times and never taken is the single strongest reason to pick it
  again, and the picker cannot say so.
- **The collection counters are global, not per arena.** `PanemRecordBook` says
  "Arena events 412/1,611"; nothing says "the Kiln: 12 of 40". Per-arena
  progress is what turns a collection number into a choice, and `eventsSeen`
  already carries arena-stamped ids (`stampEventIds` prefixes every id with its
  arena), so the split is a `filter`, not new state.
- **`lawsWonUnder`, `biomesWon` and `quellsSeen` are chase lists with no chase.**
  All three are stored, all three back achievements, and none is shown as a
  checklist anywhere a player could work through it.

**Fix.** Three additions, all reading data already on disk: a "never won here"
marker on the picker, per-arena counts on the arena card, and a checklist view
in the record book for laws, biomes and Quells.

## 9.3 The daily has an entry point; what it lacks is a memory

Also written the wrong way round first. The daily is implemented end to end:
`dailySeed()` and `dailyArenaId()` are UTC-based and shared, `dailyConfig()`
pins the settings, and `SetupScreen.tsx:561-585` renders a panel with the day's
seed, a **"Play the daily"** button that loads seed, arena and config together,
an "is this the daily" indicator, and today's best from `dailyBests`.

The gap is one line of state use. `dailyBests` is a `Record` keyed by seed, so
it holds **every** day a player has run — and the screen reads exactly one entry:

```ts
const dailyBest = (panem.dailyBests ?? {})[todaySeed];
```

So a player who has played eleven dailies sees the eleventh and nothing else.
The daily is the one feature in the game with a natural streak, a natural
comparison and a natural "I did better last Tuesday", and all three are on disk
and unread.

**Fix.** A seven-day strip under the daily panel — date, arena, victor, day —
built from `Object.entries(dailyBests)` sorted by `date`. No new state, no new
mechanics, and it converts a one-shot button into a habit.

## 9.4 Seventeen achievements never unlock, which is a replay problem before it is a content one

Detailed in §11.2. The relevant point here: all seventeen are labelled `possible`,
which the README defines as a standing invitation rather than a difficulty
rating. Seventeen of 267 (6.4%) is a reasonable number of open invitations. The
problem is that a player cannot tell an invitation from a bug, and five of the
seventeen are unreachable for structural reasons a player can never work around
(§11.2).

## 9.5 The procedural generator is broader than its content

The generator covers **12 biomes** — rainforest, volcanic, archipelago,
highlands, tundra, dunes, bayou, ruinlands, steppe, saltmarsh, boreal, badlands
— and composes each generated arena's flavour from the tags its zones actually
rolled, which is the right design and a real improvement on the four fixed packs
it replaced. `validate-arenas` plays three seeds of every biome and asserts each
composes ≥16 authored events, ≥2 once-per-run beats, a chain and ≥8 ambient
lines.

Two numbers under that:

- **`PROCEDURAL_BIOME_EVENTS` carries exactly 8 events for every one of the 12
  biomes** — distribution `{8: 12}`. A sixth instance of the pattern in §10.1,
  and the one with the lowest absolute number. A generated arena composes ~16–24
  events from tags, so roughly half of what it says is biome-specific and half is
  shared.
- **The four `PROCEDURAL_FLAVOR_PACKS` are unreachable** (§1.8): 96 authored
  events that no call site can reach, covering 4 of the 12 biomes, and holding
  the roster-wide event floor down to 24 while they do it.

So the weakest replay surface is not the generator — it is that a player who
picks "procedural" gets 8 biome-specific events per biome against a
hand-authored arena's 33–40, and 96 events written for exactly this case are
sitting in a file nothing reads.

**Fix.** Fold the 96 orphaned events into `PROCEDURAL_BIOME_EVENTS` (§1.8),
which roughly triples the four biomes that have them, then author the other
eight to match. A biome at 24 events is a generated arena that can carry a run
in its own voice; at 8 it cannot.

---

# §10 — Shallow or incomplete features; names and flavour

## 10.1 The "authored exactly to the floor" pattern, in six places at once

AUDIT-6 §7.3 named this pattern: *"37 of 40 packs sat at exactly 24 — the
signature of content written to satisfy a check rather than to fill a run."* It
is now visible in six content surfaces simultaneously:

| surface | count | floor | at the floor |
|---|---:|---:|---|
| quirk line variants | 105 quirks | 4 | **105 of 105** |
| interview scenarios | 18 personas | 15 | **18 of 18** (15 success / 15 failure) |
| arena event chains | 45 arenas | 1 | **45 of 45** |
| reaping name pools | 32 pools | 105 | **32 of 32** |
| procedural event packs | 4 | 24 | **4 of 4** |
| procedural biome events | 12 biomes | 8 | **12 of 12** |

Every one of those is a number that was met precisely and never exceeded — six
surfaces, six distributions with a single value in them. A floor reported as a
pass will always produce this; the project already knows the remedy, because
`check-flavor-pools` uses it for its global allowance and
`check-undeclared-knobs` uses it for its baseline. Apply the floor-plus-target
ratchet to all six.

## 10.2 Interview personas are 5.4x apart in use

18 personas, 6,000 tributes:

```
Mysterious Enigma 661   Quirky Oddball 582   Humble Underdog 572   Professional 464
…
Wildcard 152   Reluctant Hero 148   Grieving Sibling 122
```

Each persona carries 15 success and 15 failure scenarios, so a Grieving Sibling's
thirty scenarios are drawn from 122 times in 250 runs while the Enigma's thirty
are drawn from 661 times. The thin end of the persona table is the *over*-written
part of the interview pool, which is the wrong way round.

AUDIT-6 §10.4's finding — that every persona's scenarios all fire before the
gong — is closed by that pass's "other half of the persona bet" work.

**Fix.** The weights are in `persona.ts` and the skew comes from archetype
affinity. Flatten the bottom six and let the top three lose share; the content is
already written.

## 10.3 Flavour pool depth against measured draws

`check-flavor-pools` now reports the ratio that matters — pool size against
measured draws per run:

```
GRIEF_TEXTS                55 lines / 13.4 draws   4.1x
INTIMIDATION_TEXTS         18 / 4.1                4.4x
SANITY_TEXTS.dropItem      20 / 4.5                4.4x
SANITY_TEXTS.hallucination 40 / 8.0                5.0x
SANITY_TEXTS.ruinStealth   60 / 11.7               5.1x
SPONSOR_TEXTS              90 / 16.1               5.6x
VENGEANCE_TEXTS            72 / 12.3               5.9x
```

Seven pools under 6x. At 4.1x, a player reading one run's 926 lines sees roughly
one grief line in four repeated. `GRIEF_TEXTS` is the most emotionally weighted
pool in the game and it is the thinnest against its own draw rate.

**Fix.** The ratio is the right statistic and should become a guard, not a
report: no pool under 6x its measured per-run draw rate. That is 27 lines to add
to `GRIEF_TEXTS`, 8 to `INTIMIDATION_TEXTS`, 7 to `dropItem`.

## 10.4 Log-category balance: two categories are under 1%

Across 250 runs and ~425,000 log lines:

```
training 49,539   travel 45,852   sanity 44,236   survival 40,162   alliance 36,723
interview 35,081  system 35,057   combat 28,726   sponsor 11,979   arena 9,947
loot 8,294   injury 6,725   hazard 5,756   feast 4,723   gamemaker 4,520
death 4,332   mutt 3,823   kill 3,451   betrayal 2,414   romance 1,821
```

`romance` at 0.43% and `betrayal` at 0.57% are the two rarest categories, and
both have a filter chip, a glyph and a colour in the chronicle. A player who
filters to romance sees seven lines in a run.

`training` being the single largest category at 11.7% is also worth noting: the
three narrated training days generate more log volume than combat, and they
happen before the arena exists. AUDIT-6 §2.4 made the same observation about
pre-Games pacing.

## 10.5 Names: the pools are wide, uniform, and lopsided by letter

```
16 districts × 2 genders × exactly 105 names = 3,360 slots
distinct: 3,093   resident in two districts: 267   in three or more: 0
neutral: 16 × 24 = 384        mentors: 204 across 16 districts, min 12 each
every name a single token: 3,093 of 3,093 — no surnames, no spaces, no hyphens
length: min 3, median 6, max 12
initial letters: 26 used; S 329 … U 14  (23.5:1)
```

The no-surnames rule holds absolutely, which is the constraint the request
restates. Three shape observations:

- **Every pool is exactly 105** (§10.1).
- **The initial-letter spread is 23.5:1 on distinct names** — S 329 against U 14
  (the check reports 7.6:1 including the neutral and mentor pools). S, C and B
  are 28% of all names; U, Z and X together are 2.5%. A reaping of 24 will
  contain three names starting with S about as often as it contains one starting
  with U at all.

  The project already has the remedy and applies it to the wrong pool.
  `NEUTRAL_NAMES` exists explicitly "to flatten the initial-letter distribution",
  and `check-names` enforces `SCARCE_INITIALS = 'XUYZQIJKNEOV'` on all 384 of its
  entries. Nothing enforces anything on the 3,360 entries of the main pools,
  which is where the skew lives. **Fix: apply a scarce-initial quota to the
  district pools too** — not the neutral pool's hard rule, but a floor of, say,
  8% of each pool on the seven scarcest letters.
- **267 names are resident in two districts.** The check caps this at two and it
  is respected, but 8.6% of the roster being shared between two districts
  slightly undercuts the district-flavour premise the pools are built on.

## 10.6 Mechanics that are shallow and should be deepened rather than widened

Collected from the sections above, because this heading asks for the list:

- **The objective queue** — declared depth 2, structurally depth 1 (§1.3, §3.2).
- **`trusts` and `suspicion`** — two whole social axes at 1.0% and 1.6% fill
  (§4.1).
- **`runner` and `keeper`** — two alliance roles, unreachable and unread (§4.2).
- **Four proficiencies** — `stealth`, `carpentry`, `navigation`, `intimidation`,
  peaking at 1.00, 1.00, 2.53 and 1.68 of 6 (§3.5).
- **`stake` and `tripwire` traps** — 28 and 114 firings across 400 runs (§6.2).
- **Bluffs, standoffs and paid-in-information** — all under one per five runs
  (§6.4).
- **Bloc treaties** — 80.6% end by a side ceasing to exist rather than by a
  decision (§4.5).
- **Arena event chains** — exactly one per arena, in all 45 (§5.4).

---

# §11 — More achievements, more names

## 11.1 The roster, measured

267 entries over 500 completed runs:

```
by category:  social 59   arena 39   survival 34   capitol 30   combat 29
              games 26    oddity 25   reaping 25
by rarity:    rare 130    common 62   legendary 54   possible 21
never unlocked: 17        near-automatic (>=60%): 5
in the usable 5-60% band: 164 of 267 (61.4%)
rarity labels contradicted by the measured rate: 7
```

This is the healthiest the table has ever measured: AUDIT-6 found 207 entries, 10
unreachable, 7 near-automatic and **13** contradicted labels. The count is up 60,
the near-automatic count is down, and the contradiction count is down to 7 — all
of them one band off rather than two, which is why the build passes.

## 11.2 The seventeen that never unlock

All seventeen are labelled `possible`, which the README defines as *"the
simulation is believed to be able to do this and no measured run has ever done
it"*. Sorted by whether that is actually true:

**Genuinely open invitations (9)** — reachable, just very hard, and each carries
a documented reason: `front-loaded`, `nothing-but-hands`, `unarmed-all-year`,
`rooted`, `never-left-the-horn`, `the-quiet-one`, `careers-early`, `no-victor`,
`grey-market`. Leave them.

**Player-only, so the headless sweep can never see them (3)** —
`twelve-levers` needs a player pulling all twelve Gamemaker levers (all twelve
are exposed in `DossierPanel`; the sweep does not play in Gamemaker mode),
`the-mentor-was-right` reads `mentorIsVictor`, which only the store's career-mode
profile sets, and `every-persona` needs an 18-persona field. These are fine but
the coverage report lists them beside the genuinely hard ones, which hides them.
**Fix: mark them `playerOnly` and exclude them from the never-unlocked list.**

**Structurally blocked or near-blocked (5)** — worth acting on:

- **`master-of-one`** requires the *victor* to hold a proficiency at 6. The
  measured peak of 6.00 is reached (melee), but §3.5 shows four proficiencies
  that can never approach it, and a victor holding any at 6 was not observed in
  500 runs. Either lower the bar to 5.5 or fix the proficiency ceiling.
- **`the-unwitnessed`** is documented as structurally impossible for a victor
  (the endgame forces survivors together) and was rewritten to ask for the final
  eight instead; it still never fires. Re-measure the gate.
- **`expelled-and-won`** needs a victor who was expelled. Expulsions run 139 per
  400 runs; a victor among them was never seen. Plausible but worth a nearMiss
  check.
- **`every-door`** needs every once-per-run event in one Games. Six arenas carry
  only three; the rest carry 4–7. A pack with seven is a very long odds ask.
  **Gate it to arenas with ≤4 once-per-run events, or raise the floor.**
- **`the-short-week`** needs a finish by day 3. Run length is now 11.0 days by
  design (§9.1), so the AUDIT-6 retune made this *harder*, not easier. It is
  advertised only where the calendar makes it reachable, which is correct — but
  it should be re-measured against the compressed temperament specifically.

## 11.3 The five near-automatic

```
made-them-blink     91.2%     the-unnamed        66.2%
outlived-the-map    79.8%     someone-elses-war  64.4%
kept-word           75.0%
```

Down from seven. `made-them-blink` at 91.2% is a participation ribbon on a list
that is supposed to be a menu — it fires in nine runs of ten. Tighten all five by
one notch of their own condition; the shape of each is right, the threshold is
loose.

## 11.4 Seventy achievements to add

Written against state the engine already holds, grouped by the category that is
thinnest relative to how much simulation sits behind it. `reaping` and `oddity`
are the smallest categories at 25 each; `social` is the largest at 59 and is
excluded.

**Arena and map (14)** — reads `visitedZones`, `edgeRules`, `zoneEffects`, `verticality`, `loadBearing`
1. Cross a `tolled` edge without paying. 2. Hold a `contested` edge for four
cycles. 3. Find every `hidden` edge in one arena. 4. Win in an arena with no
water source. 5. Bring down a `ruins` zone on somebody else. 6. Survive a zone
collapsing under you. 7. Win without ever standing on an `upper` level. 8. Win
having stood on every `upper` level. 9. See all ten zone-effect kinds in one
Games. 10. Win in a zone that was `irradiated` when you entered it. 11. Cross a
`collapsing` edge on its last cycle. 12. Win an arena under its off-season skin.
13. Win under three stacked laws. 14. Trigger the arena's set piece and survive
it in the same cycle.

**Reaping and pre-Games (10)** — reads `trainingScore`, `interviewStrategy`, `castShape`, `mentorLegacy`
15. Crown a victor who scored 1 in training. 16. Crown a victor who scored 12.
17. Win a `victors-field` year. 18. Win an `all-volunteer` year. 19. Crown a
victor whose district partner also reached the final four. 20. Win with the
lowest training score in the field. 21. See both District 12 tributes score 8+.
22. Crown a victor who failed their interview. 23. Win a year with three or more
Careers dead in the bloodbath. 24. Crown a victor from a `forgotten`-tier
district in a `career-heavy` year.

**Oddity (12)** — reads `epithet`, `legendName`, `quirks`, `notoriety`, `rumours`
25. Crown a victor who earned an epithet before day three. 26. Win holding a
weapon that earned its name in somebody else's hand. 27. Win with a weapon that
has killed four times. 28. See one weapon change hands three times. 29. Crown a
victor nobody ever swore vengeance against. 30. Crown a victor sworn against by
four people. 31. Win having planted a rumour that was never exposed. 32. Win
having believed three false rumours. 33. See a tribute die in the zone they
started in on the last day. 34. Crown a victor who never slept. 35. Crown a
victor whose quirk fired in every phase. 36. Win a Games in which no cannon fired
before day four.

**Survival and the body (12)** — reads `condition`, `woundInfection`, `scars`, `sleepDebt`, `frostbitesTaken`
37. Win as `Wasted`. 38. Win having never been above `Lean`. 39. Survive a
terminal infection. 40. Win carrying four scars. 41. Win having treated three
other people's wounds. 42. Win having never eaten. 43. Win having never drunk
from a water source. 44. Take frostbite in three separate cycles and win. 45. Win
at 5 health or less. 46. Recover from the sanity floor to above 70. 47. Win
having lost and regained a limb's use. 48. Win without ever taking a wound to
your weapon hand.

**Capitol and the booth (10)** — reads `gamemakerUse`, `sponsorTrust`, `sideBets`, Quell state
49. Win a Quell you forced. 50. See all four Quell law categories in one
playthrough's records. 51. Crown a victor no sponsor ever backed. 52. Crown a
victor backed by four blocs. 53. Win a side bet on a bloodless crown. 54. Pull
`mercy` on the eventual victor. 55. Pull `reveal` on the eventual victor and
watch them survive. 56. Strip the zone the victor was standing in. 57. Win with
sponsor trust at zero. 58. See a prop bet on a wounded crown pay out.

**Games shape (12)** — reads run-level state
59. A Games where the bloodbath took nobody. 60. A Games where the bloodbath took
half the field. 61. A Games with no feast. 62. A Games with three feasts. 63. A
Games where every district lost exactly one tribute. 64. A Games decided in the
convergence. 65. A Games where the last two were allies for five days. 66. A
Games with no betrayal at all. 67. A Games with ten betrayals. 68. A Games where
the favourite won. 69. A Games where the longest-priced tribute won. 70. Two
consecutive runs won by the same district.

## 11.5 Names: the state, and what to add

Measured in §10.5. The pools are wide (3,360 reaping slots, 3,093 distinct, 384
neutral, 204 mentors), single-token throughout, and capped at two districts per
name. The **no-surnames rule is respected absolutely** and nothing below breaks
it — every name is one token, no spaces and no hyphens.

Two shape problems to fix while adding:

- **Every pool is exactly 105.** Add unevenly on purpose so the number stops
  being a target.
- **The initial-letter spread is 23.5:1.** Weight new names toward U, Z, X, Y, I,
  Q and O.

## 11.6 Two hundred names to add, no surnames

Every name below is **one token, no space, apostrophe or hyphen** — the form
`check-names` enforces with `/[\s'-]/` and the form the request restates. All two
hundred were validated against the live pools before being written here:

```
total 200   distinct 200
already resident in any district or neutral pool:  0
surname/compound violations:                       0
```

They are weighted hard toward the initials the pools are short of, which is the
§10.5 finding and the same principle `NEUTRAL_NAMES` is built on
(`SCARCE_INITIALS = 'XUYZQIJKNEOV'`):

```
O 43   U 38   Y 37   Z 27   X 24   Q 21   I 10
```

Measured: adding all two hundred moves the distinct-name letter spread from
**23.5:1 (S 329 : U 14) to 6.9:1 (S 329 : J 48)**, and lifts U from 14 names to
52. The bottom of the table becomes E 73, X 59, I 56, Z 55, U 52, J 48 — a tail
rather than a cliff.

**District 1 — luxury (20):** Ormer, Uvarov, Illume, Ouro, Yttrian, Ursine,
Orfevre, Zendal, Xoana, Quadrille, Yale, Zibel, Oriel, Yestre, Xanthene,
Ormolet, Ulmira, Xantheon, Ouvert, Yvane.

**District 2 — stone and arms (20):** Zosim, Obdur, Yeomanry, Zelot, Unctor,
Xiphos, Ossuar, Ylva, Zanthe, Ulfheim, Oubliette, Zemin, Ingar, Ogmund, Yrsa,
Uldric, Zorath, Ostrog, Yvarr, Xenos.

**District 3 — circuitry (20):** Ustor, Oscillo, Xand, Querl, Opto, Zed, Ionn,
Xenna, Quibit, Ulvex, Zolta, Ydris, Xantic, Querin, Ondel, Yttrix, Uvex, Ixel,
Quarz, Orbit.

**District 4 — the sea (20):** Quahog, Ushant, Orca, Yare, Ulva, Iselin,
Zeeman, Ythan, Xandine, Yssel, Zephyral, Xebecca, Yolde, Umbriel, Yarrowreef,
Ondelle, Quillara, Ulvine, Ostrean, Yvelle.

**District 5 — power (18):** Urd, Zolt, Xelas, Ovolt, Xanthin, Oersted, Xerus,
Orrey, Yonge, Ionel, Zephyrin, Ultima, Xandor, Querent, Ohmura, Yseult, Uvolt,
Zinnober.

**District 6 — transit (18):** Unar, Zephyros, Onward, Yarding, Ulrich, Oakum,
Yancy, Ulmar, Xantho, Querry, Oaklan, Zephyrel, Ultan, Xandry, Quintin,
Ostler, Yarrel, Urbain.

**District 7 — timber (18):** Umbrel, Zirco, Yewen, Undergrowth, Quickset,
Oakhew, Ulmus, Ossier, Yarrowood, Quirin, Yewel, Zephyrwood, Undertimber,
Quillwood, Ordrey, Yarden, Ulmwood, Iselwood.

**District 8 — textiles (18):** Zibellin, Undyed, Quiller, Ottoman, Yarnell,
Zendale, Xestile, Quinsy, Ombre, Youghal, Ingram, Xanthide, Querda, Oakweft,
Ysolt, Ulmine, Orlon, Yardwell.

**District 9 — grain (18):** Yeld, Zephyrum, Oryza, Zizania, Undercrop,
Quickgrass, Oakhull, Ulmer, Xandel, Querlot, Ostgrain, Yarrowe, Ultgrain,
Ixil, Orsey, Yestergrain, Umberly, Zolder.

**Districts 10–16 — livestock, orchards, mining and the outer territories
(30):** Urial, Zebu, Xolo, Ovis, Ungula, Xiphoid, Yester, Zuccar, Ochre,
Yestreen, Ulmic, Xanthate, Quartzel, Oremund, Zircol, Undermere, Orepeak,
Yestermine, Ironhew, Xandric, Querhold, Ozmun, Ylsa, Zephyrion, Ulvaine,
Xanterra, Quarnell, Ostrel, Yarrowmine, Undervein.

Add them unevenly — some districts gaining 18 and some 20 — so that no pool
lands on a round number and the "exactly 105" signature in §10.1 is broken
rather than moved.

---

# §12 — More traits, skills, archetypes

## 12.1 The current shape

```
traits        119  (96 rollable, 23 earned)   TraitMod keys: 59 declared, 58 written
archetypes     29  all carrying targetDraw, fearScale, riskCurve, objectiveBias,
                   preferredTraits and a signature; 2 missing hatesArchetypes
stances        10  (3 unconditional, 7 conditional)
proficiencies  15  (4 of which never leave their floor — §3.5)
quirks        105  (all 105 carrying engine mods, all 105 with exactly 4 lines)
```

Every one of these grew since AUDIT-6 (traits 95→119, archetypes 15→29,
proficiencies 11→15, stances 8→10). The vocabulary is wide. The findings below
are about the parts of it that do not bind.

## 12.2 Fix what is declared before adding more

Four items, restated from their own sections because this heading is where
somebody adding content will look:

- **`TraitMod.intimidation` has a read site and no writer** (§1.4). One of 59
  keys returns 0 for every tribute in the game.
- **Thirteen `TraitMod` keys are carried by two traits or fewer:**
  `suspicionResist`, `leadership`, `debtHonour`, `charterHold`,
  `rumourCredibility` and `haggle` by **one trait each**; `executeDrive`,
  `rangedPower`, `hornCommitment`, `burnOnHit`, `vengeanceEdge`, `muttDamage`
  and `trustGain` by two. A key carried by one trait is a key whose effect is
  indistinguishable from that trait.
- **`stealth` and `carpentry` peak at 1.00 of 6** across 6,000 tributes (§3.5).
  `carpentry` in particular duplicates `crafting`, which peaks at 5.85 — the same
  verb split across two axes with one call site.
- **Two archetypes declare no antipathies** (§8.4).

## 12.3 Thirty new traits

Each is a data row against an existing `TraitMod` key. Priority to the thirteen
under-carried keys above, so adding traits also fixes §12.2.

**Carrying an under-used key (13):**
1. **Watchful** — `suspicionResist 0.25`, `awareness 0.3`. Hard to work on.
2. **Standard-Bearer's Second** — `leadership 1.2`, `allianceAffinity 0.05`.
3. **Good for It** — `debtHonour 0.4`, `trustGain 0.2`.
4. **Letter of the Law** — `charterHold 0.3`, `treachery -0.05`.
5. **Straight Story** — `rumourCredibility 0.8`, `haggle -0.2`.
6. **Horse Trader** — `haggle 0.6`, `persuasion 0.4`.
7. **Finisher** — `executeDrive 0.15`, `killSanity 0.2`.
8. **Long Sight** — `rangedPower 1.5`, `meleePower -0.5`.
9. **First Off the Plate** — `hornCommitment 0.2`, `retreat -0.03`.
10. **Cinder-Handed** — `burnOnHit 0.1`, `burnResist 0.2`.
11. **Grudge-Fed** — `vengeanceEdge 2.0`, `sanityDrain 0.1`.
12. **Beast-Wise** — `muttDamage -0.2`, `awareness 0.2`.
13. **Takes People As They Come** — `trustGain 0.4`, `suspicionResist 0.15`.

**Body and deprivation (5):** 14. **Thrifty** (`hungerDrain -3`, `fatigueDay
0.5`). 15. **Sun-Fed** (`heatResist 0.3`, `coldResist -0.15`). 16. **Slow Burn**
(`fatigueNight -1.5`, `fatigueDay 0.8`). 17. **Hollow Leg** (`thirstDrain -3`,
`poisonResist -0.1`). 18. **Set Bones** (`bleedResist 0.2`, `agility` drift).

**Combat (5):** 19. **Left-Guard** (`defended 0.15`, `unarmedPower 1.0`).
20. **Overreach** (`meleePower 2.0`, `retreat -0.08`). 21. **Counterpuncher**
(`wrestle 0.5`, `combatPower 0.5` only when defending). 22. **Spent** (earned;
`combatPower -1.5`, `sanityRecovery 2`). 23. **Blooded Twice** (earned;
`vengeanceEdge 1.5`, `fearGain -0.15`).

**Social (4):** 24. **Reads the Room** (`rapport 0.5`, `persuasion 0.3`).
25. **Owes Nobody** (`debtHonour -0.3`, `betrayalResist 0.2`). 26. **Keeps
Books** (`charterHold 0.25`, `leadership 0.4`). 27. **Spoken For** (`allianceAffinity
0.1`, `targetDraw 0.5`).

**Field and mind (3):** 28. **Reads Ground** (`forage 0.06`, `navigation`).
29. **Night Ear** (`awarenessNight 0.6`, `awareness -0.1`). 30. **Steady Hand**
(`medicine 0.08`, `trapSkill 0.05`).

## 12.4 Repair two proficiencies, then add four

**Repair first**, because adding to a fifteen-axis set where four axes are inert
(§3.5) makes the sheet less legible, not more:

- **`carpentry` and `crafting` are one verb split in two.** `crafting` peaks at
  5.85, `carpentry` at 1.00 — the starting value — across 6,000 tributes,
  because shelters and traps train `crafting` and nothing trains `carpentry`.
  Fold them together, or give `carpentry` the shelter and trap call sites and
  leave `crafting` the tools.
- **`stealth` peaks at 1.00 too**, in a game with a `ghost` archetype, a whole
  `engine/stealth.ts`, an `ambush` modifier and 965 measured ambushes per 400
  runs. It needs one `trainProficiency` call off a successful hide.

**Then add four.** Each one takes over a gate that today reads a raw attribute,
or borrows a proficiency from a different skill. All four read sites were checked:

| proficiency | what it is | what that gate reads today |
|---|---|---|
| `signalling` | laying and reading marks, whistles, false trails | `intent.ts:169-170` — raw `attributes.intelligence`, plus `tracking` doing borrowed duty |
| `fieldcookery` | turning found food into food that does not turn | `exposure.ts:135` — a terrain profile and the `poisonResist` trait mod; **no proficiency at all** |
| `pacing` | how far somebody goes before the fatigue curve bites | `map.ts:travelCost` — terrain, injury grade, trait mods and physique; **no proficiency at all** |
| `reading-people` | telling a bluff from a threat | `parley.ts:755` — raw `mark.attributes.intelligence`, with `tracking` again standing in (the function's own comment says so) |

Two of the four gates read no proficiency at all, and the other two borrow
`tracking`, which is why `tracking` shows up in seeing through a bluff. Each
addition makes an existing roll trainable, which is the pattern the eleven
working proficiencies already follow. None of them adds a subsystem.

## 12.5 Six new archetypes

Each declares all seven fields, hates somebody, and has a signature that is
reachable by a soloist (the §8.2 constraint).

1. **The Cartographer** — objective bias `reach`, hates `ghost`. Signature: names
   a route through the arena and holds to it when everybody else is reacting.
2. **The Debtor** — arrives owing somebody in the field. Objective bias `protect`,
   hates `broker`. Signature: the debt comes due in front of the cameras.
3. **The Forecaster** — reads weather and ground. Objective bias `hold`, hates
   `wildcard`. Signature: is somewhere sheltered before the front arrives.
4. **The Quiet Professional** — no persona, no interview angle, no antipathy
   declared *at* anybody. Signature: the field realises on day five that nobody
   has seen them.
5. **The Understudy** — reaped in someone else's place and says so. Objective
   bias `survive`, hates `martyr`. Signature: outlives the person who volunteered.
6. **The Archivist** — remembers every death and recites them. Objective bias
   `wait`, hates `confessor`. Signature: names the fallen in order at the feast.

## 12.6 Two new stances

Constrained by §3.3: an eleventh stance lands at ~1.5% unless a default is made
conditional first.

- **Tending** — a tribute working on themselves rather than the arena: dressing a
  wound, drying out, sleeping properly. Family `defensive`, conditional on a
  treatable injury and no threat within two zones. Takes share from Nursing and
  from Evasive.
- **Baiting** — deliberately visible, to draw somebody onto ground you chose.
  Family `aggressive`, conditional on a set trap or a held chokepoint in the
  current zone. Takes share from Hunting, and is the first stance that makes
  `fieldcraft`'s 72.7% untriggered traps (§6.2) into a plan.

---

## Priority

Ordered by cost against consequence, not by section.

**Fix now — correctness, all proven, all small:**
1. §1.2 — the two config normalisers that delete fields on every read. A resumed
   one-victor run can end with two victors.
2. §1.1 — the five sanity dials missing from the Share URL.
3. §1.3 — the objective queue that can never hold two.
4. §1.4 / §1.5 — one `TraitMod` with no writer, two quirk mods set to zero.

**Fix next — instruments that are reporting the wrong thing:**
5. §1.6 — the trait-spread guard measuring two traits and printing MET; and
   §8.7, a 1,600-run metrics job on push to `main` so §8's rows can be judged.
6. §1.7 — the authored-event ratchet with floor equal to target.
7. §1.8 — 96 procedural events no call site can reach, holding the ratchet down.
8. §1.9 — the ungated destination-best number and the one-screen tap census.
9. §1.10 — add ESLint so thirteen `react-hooks` disables mean something.

**Then — the findings with the largest design consequence:**
10. §4.1 — `trusts` at 1.0% and `suspicion` at 1.6%, which is also the cause of
    §4.3's near-dead alliance politics.
11. §4.2 — the two alliance roles that are unreachable and unread.
12. §3.5 — the four proficiencies that never leave their floor.
13. §8.2 — the 3.05x archetype-signature spread, with three signatures under 25%.
14. §2.1 — 119 of 119 controls under the tap-target minimum.

**Then — content, in the order that most changes a run:**
15. §7.2 / §7.3 — twenty universal deaths and twelve arena-specific ones.
16. §5.4 — three chains per arena instead of one; §9.5 — 8 events per biome.
17. §10.1 — break the six floors that were authored to exactly.
18. §11.4 / §11.6 — seventy achievements and two hundred names.
19. §12.3 / §12.5 / §12.6 — thirty traits, six archetypes, two stances.

## What this report is not asking for

Recorded so the next audit does not spend effort re-finding them: `test:ui` in
CI (§2, closed by AUDIT-6), legendary weapons (§6.1 — they work), mutt roster
reach (§5.5 — 100%), epithet distribution (§10.1 — flat now), run length and its
spread (§9.1 — 11.0 days, sd 2.69, goal met), arena authored-layer coverage
(§5.1 — 45/45 on every row), the ledgers (§4.6 — truce, vengeance and loan all
reconcile exactly), trait and archetype win balance (§8.1, §8.3 — 2.20x and
2.36x at n=1,600), and district legacy (§8.4 — a deliberate 2.4x handicap that
is working).
