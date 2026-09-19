# Survival Games — eighth full audit (12 sections)

## Context

This is the eighth full audit of the repository, written to the twelve
headings the request named and kept to them — no heading is folded into
another, and nothing is answered by pointing at a different section.

It was written on commit `3729510` (`Merge pull request #62`), on a clean
checkout, with the repository's own check roster run to completion at **both**
the run count CI uses and the run count its guards need — §1.1 turns on the
difference — and six purpose-built probes on top of it. Every number below was measured on this
commit. Where a number contradicts an earlier audit, the earlier number is
named and the discrepancy explained rather than quietly replaced — three of
the previous seven audits reported a false zero because the instrument was
wrong, and the only defence against a fourth is to say what was measured and
how.

### The repository, on this commit

```
198 files, 113,875 lines of TypeScript/TSX
  src/engine        87 modules  (simulation, incl. 8 phase modules:
                                 pregames, training, interviews, bloodbath,
                                 alliances, dayNight, feast, epilogue)
  src/data          36 modules  (54,099 lines — arenaFlavor.ts alone is 14,950)
  src/components    38 files    (interface)
  src/screens        9 files
  src/store          5 files
  scripts           16 checks
```

Content, counted from the real data rather than grepped:

| Pool | Count |
|---|---|
| Traits | 149 (124 rollable, 25 earned) |
| `TraitMod` keys | 59, all carried, none at zero |
| Quirks | 105 (all carry mods; 4 line variants each) |
| Archetypes | 35 |
| Stances | 12 |
| Proficiencies | 19 |
| Interview personas | 18 |
| Achievements | 336 + 22 meta — but see §1.4: **318 distinct**, 34 are duplicates |
| Hand-authored arenas | 45 (470 zones) |
| Arena flavour packs | 45 (1,542 authored events, mean 34.3) |
| Arena set-piece packs | 45 (**exactly 7 events each, all 45**) |
| Universal events | 108 |
| Procedural biomes | 12 |
| Mutts | 216 across 52 rosters |
| Items | 64 + 6 improvised |
| Arena laws | 23 declared, all in use |
| Edge rules | 103 across the roster, 7 kinds |
| Zone-effect kinds | 10 |
| Reaping names | 3,944 across 16 districts + 384 neutral |
| Mentors | 204 |
| Balance knobs | 2,364 across 133 groups, all referenced |

### The check roster, on this commit

Every check was run. Fifteen simulation/content checks plus the browser
harness (`test:ui`, which needed `CHROMIUM_PATH` pointed at the preinstalled
Chromium in this environment — the pinned Playwright expects a newer build id
than the image carries; the script already supports the override):

```
lint                    PASS    (tsc --noEmit && eslint .)
test:sim                PASS    400 runs, no invariant violations, 110/110 probes live
test:knobs              PASS    2,364 knobs, all referenced
test:undeclared-knobs   PASS    85 known sites, no new ones
test:storage            PASS    23 migration properties
test:arenas             PASS    45 arenas structurally sound
test:arena-layout       PASS    165 layouts, no label collisions
test:names              PASS    3,944 names, 4.2:1 initial spread
test:flavor             PASS    but see §10.1
test:unnamed            PASS    4.3% against a 4.0% baseline
test:achievements       PASS    336 entries, 26 never unlock, 10 near-automatic
test:predicates         PASS    43 hard-coded trait sites (ceiling 44)
test:zone-features      PASS    470/470 zones carry an authored interior
test:decisions          PASS    55.6% best-stance, 66.0% best-destination
test:ui-affordances     PASS    0 hover-only hints, 0 unnamed value hints
test:ui                 PASS    52/52 steps, no console errors
test:metrics (n=400)    PASS    all archetype guards abstain at this sample
test:metrics (n=1,600)  FAIL    1 regression guard breached — see §1.1
```

**`main` is red, and has been since before this audit started.**

`ci.yml` has two jobs that run `test:metrics`. The `check` job runs it with no
`METRICS_RUNS`, i.e. at 400 runs, where **no archetype clears
`GUARD_MIN_SAMPLE` (500 entrants)** — so the archetype guards abstain entirely
and that job passes. A second job, `balance`, runs `METRICS_RUNS=1600` and is
gated `if: github.event_name == 'push'`, so it runs on merges to `main` and is
skipped on pull requests.

That job fails. On `638a726` and on `3729510` before it:

```
CI | 638a726 | completed | failure      check success | balance FAILURE | ui success
CI | 3729510 | completed | failure      check success | balance FAILURE | ui success
```

The `quiet` archetype's signature fires for 4.5% of its holders against a floor
of 29%, and `quiet` was added by AUDIT-7 §12.5.

Two consequences, and the second is the one worth keeping:

1. `main` is failing its own roster on merge, and has been for two commits.
2. **A pull request cannot see it.** The 1,600-run pass is push-only, so every
   archetype guard — the signature floor, the win spread, the worst and best
   archetype rates — is vacuous on every PR. A regression in any of them
   merges green and turns `main` red afterwards, which is the exact failure
   mode `ci.yml`'s own header comment says the file was created to prevent.

### The probes

Six purpose-built harnesses, all built on `Simulator.observe` (the
per-phase observation point Audit 4 §1.10 added precisely so probes stop
guessing which fields survive to the epilogue):

- **census** — every authored pool counted from the imported data, plus
  cross-reference integrity between tables.
- **probe** — 400 runs across all 46 arena ids and four configs, sampling
  stance, objective, proficiency, alliance roles, personas, bodies, log
  categories, items, traits and causes of death per phase.
- **reach** — 400 runs, asking of each subsystem "did this run contain one
  at all", plus universal-death reach by cause substring.
- **quiet** — 200 runs, per-archetype `unseenStreak` distribution.
- **phantom** — cross-table reference integrity (archetype → trait,
  archetype → archetype, quirk → mod).
- **events** — authored event and set-piece counts per pack.

Probe sources were removed before the commit; every number they produced is
reproducible from the description above.

### One claim this report withdrew, and then reinstated

Recorded in full because the round trip is the lesson, and because two of the
previous seven audits shipped a false zero from a half-read instrument.

The first draft of §1.1 said `main` was red. A second pass withdrew that: `ci.yml`
runs `test:metrics` at 400 runs, the guard abstains for want of sample, and the
job passes. **That withdrawal was wrong** — it was made after reading only the
first job in the workflow file. There is a second job, `balance`, which runs
`METRICS_RUNS=1600` on push to `main`, and it fails, on the audited commit and
on the one after it. `main` is red.

The finding in §1.1 is now the union of all three passes: the signature is
broken, the job that catches it runs only after the merge, and a pull request
therefore cannot see any archetype guard at all.

### Five things this report checked and did not find

Stated up front, because an audit that only reports faults implies the rest is
unexamined.

1. **The Share URL is complete.** AUDIT-7 §1.1 found five simulation-affecting
   settings missing from it and §2.2 found the five sanity dials unshareable.
   `test:storage` now asserts "the Share URL carries every GameConfig field, or
   declares why not" and "a shared link round-trips every config field through
   the parser". Both pass. Fixed, and guarded.
2. **Save/HoF reads no longer drop config fields.** AUDIT-7 §1.2. Three
   storage properties now assert it. Fixed.
3. **Legendary weapons are visible.** AUDIT-7 §6.1 — `legendName` and
   `bloodDrawn` are both rendered in `TributeModal`, the latter with an
   accessible label. Fixed.
4. **`TraitMod` has no unwritten keys and no zero-valued modifiers.**
   AUDIT-7 §1.4 and §1.5. `test:flavor` asserts both at a ceiling of zero.
   Fixed, and ratcheted.
5. **ESLint is real now.** AUDIT-7 §1.10 found thirteen
   `eslint-disable react-hooks/exhaustive-deps` directives in a project with no
   ESLint installed. ESLint is installed, configured, and in `lint`; eleven
   directives remain and all eleven now suppress a rule that actually runs.
   There are zero `@ts-ignore`/`@ts-expect-error` in the repository and zero
   `TODO`/`FIXME`/`HACK` comments.

---

# §1 — All bugs

Thirteen findings. Six are proven defects with a measured consequence; the rest
are integrity gaps that have not yet produced a visible failure.

## 1.1 The `quiet` signature fires for 4.5% of its holders, and `main` is red because of it — *proven, CI-breaking*

At `METRICS_RUNS=1600`:

```
archetype signature fire rate (share of entrants whose set piece fired):
  forecaster    60.9%  (n=558)
  ...
  captor        29.1%  (n=567)
  quiet          4.5%  (n=582)
  spread: forecaster 60.9% vs quiet 4.5%
  1 signature(s) under the 29% floor: quiet 4.5%

1 regression guard(s) breached.
```

An independent 400-run probe measured 2.2% (n=135). The finding reproduces.

**The guard does not vote on a pull request.** The `check` job runs at 400
runs, and the guard is `const fired = rates.filter(r => r[2] >=
GUARD_MIN_SAMPLE)` (`scripts/metrics.ts:1101`, `GUARD_MIN_SAMPLE = 500`). At
400 runs the script itself reports:

```
Note: duellist, career, opportunist, ... archivist drew fewer than 500
entrants; reported above, but not guarded

All regression guards hold.
```

**All thirty-five archetypes are under-sampled at the run count a PR uses**, so
the signature floor is applied to an empty set and passes vacuously. The
abstention is deliberate and correct in itself — AUDIT-6 added it because "a
guard with an empty sample behind it now reports and does not vote", after
adding six archetypes dropped every one of them under the threshold. And the
`balance` job exists precisely to cover that gap. What the arrangement does not
do is cover it *before* the merge: the failure lands on `main` and blocks the
Pages deploy with the bad commit already in history, which is what `ci.yml`'s
header comment describes as the reason the file was written.

The archetype it names was added by AUDIT-7 §12.5, whose stated new rule for
that batch was *"every signature must be reachable by a soloist."* The Quiet
Professional's is reachable by a soloist and by almost nobody else — including
its own holders.

**Why.** `quietWork` (`engine/archetypeHooks.ts:836`) gates on
`unseenStreak >= ARCHETYPE_HOOKS.quietUnseenCycles` (4), and
`runArchetypeSignatures` only offers any signature on a 25% roll per cycle. So
the real requirement is *a four-cycle unbroken unseen streak that happens to
coincide with the 1-in-4 offer*. The streak is reset at the end of every cycle
in which any non-ally shares the tribute's zone
(`phases/dayNight.ts`, the upkeep `board.forEach`).

The 200-run probe measured the whole field's peak `unseenStreak` per tribute:

```
archetype        n   meanPeakUnseen  share reaching 4 cycles
ghost          148       2.01              19.6%
medic          120       1.82              19.2%
quartermaster   93       1.70              18.3%
protector      253       1.56              17.0%
warden         159       1.60              16.4%
...
quiet           75       1.03               9.3%    <-- the archetype whose
understudy      83       0.89               6.0%         entire premise is this
wildcard       199       0.89               7.0%
```

**The Quiet Professional reaches its own gate less often than the field
average, and less than half as often as the Ghost.** The cause is in its own
data row: `quiet`'s stance bias is `{Evasive: 0.5, Hunting: 0.3, Shadowing:
0.4}` and its objective bias is `{survive: 0.4, stalk: 0.4}`. Measured stance
share for `quiet` holders across 200 runs:

```
Defensive 292 | Evasive 193 | Aggressive 98 | Fortified 52 | Scavenging 18
Shadowing 16 | Baiting 18 | Patrolling 7 | Nursing 7 | Hunting 7 | Tending 4
```

They spend more cycles Defensive than Evasive, and `stalk` — one of their two
top objectives — is *following a named person*, which puts them in that
person's zone, which resets the streak by definition. The archetype's own
objective bias defeats the archetype's own signature gate.

This also matters beyond `quiet`: `unseenStreak` is the currency of three
separate systems — `Silent Step` (5 cycles), `ghostNaming` (a reachability
clause), and `quietWork` (4 cycles) — and the whole field's mean peak is 1.3
cycles. The currency is denominated far above what the movement layer actually
produces.

**Fixes, in preference order.**
1. `quietUnseenCycles: 4 → 2`, which the field reaches ~35% of the time, and
   read `t.stance` rather than the raw streak as the second condition
   ("un-looked-for" includes Evasive-and-alone, not just literally-alone).
2. Move `stalk` out of `quiet`'s objective bias — it belongs to `tracker`,
   which also carries it — and replace it with `wait`, which is the one
   objective in the game that wants nobody else to arrive and is the top bias
   of only three archetypes.
3. Whichever is taken, add the streak distribution to `metrics.ts` as a
   reported line, because three systems key off it and none of them was
   measuring it.
4. **Separately: move the `balance` job onto pull requests**, or fail the
   400-run pass when every row of a guard is under-sampled. A guard that
   cannot fire on a PR is a guard that reports regressions one merge too late,
   and the green tick on the PR is read as evidence that it will not.

## 1.2 The Broker's fourth preferred trait does not exist — *proven*

`src/data/archetypes.ts:1025`:

```ts
preferredTraits: ['Barterer', 'HardBargain', 'Bookkeeper', 'Broker'],
```

The trait is `'Hard Bargain'` (`src/data/traits.ts:694`). `'HardBargain'` is
not a key of `TRAIT_DEFS`. The generator does not validate against the table —
it assigns the string — so the trait is issued and is completely inert:
`traitMod()` finds no row, `traitProficiencyFloor()` finds no row, and
`traitInfo()` returns the fallback string **"No recorded effect."** on the
tribute sheet.

Measured at n=1,600, `metrics.ts` reports both, side by side, and nobody
noticed:

```
  Hard Bargain       355    6.76%
  ...
  HardBargain        174    3.45%
```

**174 tributes in 1,600 Games walk into the arena carrying a trait that is a
typo, displayed to the player as a trait with no recorded effect, at half the
win rate of the real one.** It is a quarter of the Broker's trait identity, and
the Broker sits 32nd of 35 on the win table at 4.07%.

`INCOMPATIBLE_TRAITS` correctly pairs `['Horse Trader', 'Hard Bargain']`, so
the typo'd copy also escapes the one conflict it was supposed to have.

**Fix.** One character. **Then add the guard**, because nothing in fifteen
checks catches this class of error: `check-predicates.ts` already imports
`TRAIT_DEFS` and `ARCHETYPES` — assert that every `preferredTraits` entry,
every `INCOMPATIBLE_TRAITS` member and every `hatesArchetypes` id resolves.
The probe that found this took nine lines.

## 1.3 The condition axis's "rare extreme" is the modal roll — *proven*

`engine/physique.ts:rollBody`:

```ts
// Nobody walks into an arena Wasted, let alone Skeletal; everyone has been
// fed for a week in the Capitol. The bottom of the condition scale is
// somewhere the run takes you, not somewhere you start — and the top is
// rare for the same reason the top of the frame scale is.
let conditionIdx = Math.min(4, Math.max(0, pickIndex(4))) + 2;  // Lean .. Bulky
if (conditionIdx === 5 && pickIndex(4) === 0) conditionIdx = 6;
```

`pickIndex(n)` is `rng.nextInt(0, n)`, which is **inclusive**: `pickIndex(4)`
returns 0–4, five outcomes. So `conditionIdx` is 2–6, and
`CONDITIONS = ['Skeletal','Wasted','Lean','Conditioned','Padded','Bulky','Hulking']`
— index 6 is `Hulking`. The comment says "Lean .. Bulky"; the code says
"Lean .. Hulking".

The promotion line below it then adds a further 1-in-5 chance on top of the
1-in-5 that already lands there. Predicted distribution: Hulking 24%, Lean /
Conditioned / Padded 20% each, Bulky 16%.

Measured over 7,640 tributes:

```
condition = {Hulking:1857 (24.3%), Conditioned:1573 (20.6%), Padded:1530 (20.0%),
             Lean:1357 (17.8%), Bulky:1285 (16.8%), Wasted:28, Skeletal:10}
```

Exactly as predicted. **`Hulking` — the top rung of the soft-tissue scale, the
one the comment calls rare — is the single most common condition a tribute is
reaped with**, and `Bulky`, the rung directly below it, is the *least* common
of the five. The intended shape is a bell with rare ends; the produced shape is
a ramp with an inverted notch.

Compare the frame axis two lines above, which is written correctly:
`Math.min(4, Math.max(0, innerIdx)) + 1` gives indices 1–5 (Narrow..Heavy, the
five inner rungs) and the promotion reaches 0 and 6. Measured: `Slender` 0.6%,
`Massive` 4.1% — rare, as designed.

**Consequences, all of them live.** `conditionStep` is read by seven
functions in `physique.ts`. At the modal `+3`:

- `insulation()` — the modal tribute has maximum cold resistance.
- `heatTolerance()` — and maximum heat tolerance.
- `waterNeed()` — and the maximum water requirement.
- `conditionAgilityPenalty()` — and the maximum agility penalty.
- `injuryAbsorb()` — and the maximum injury absorption.
- `starvationBuffer()` — and the maximum starvation buffer.

The two-axis body model exists so frame and condition *pull in different
directions*; a distribution that puts a quarter of the field on one extreme
of one axis collapses the interesting half of it. It also propagates into
`deriveBuild`, which sums the two orders — which is why the eleven-rung Build
ladder measures:

```
build = {Average:1875, Stocky:1465, Athletic:1423, Burly:1327, Muscular:1164,
         Lean:264, Hulking:72, Wiry:43, Slight:7, Frail:0, Skeletal:0}
```

**`Slight` is 0.09% of the field, `Wiry` 0.56%, and `Frail` and `Skeletal` are
unreachable at the reaping.** Five of eleven rungs of a ladder widened
specifically so "a long, light frame and a short, dense one" would stop
collapsing onto `Slight` are between rare and impossible.

**Fix.** `pickIndex(4)` → `pickIndex(3)` on the condition line. That restores
Lean..Bulky as the base range and makes the promotion do the job it was
written for. Then add to `metrics.ts` a frame/condition/build distribution
report, since neither axis has ever been measured by anything.

## 1.4 Thirty-four achievements are sixteen achievements — *proven*

Ten per cent of the achievement roster is duplicated. Compiling every entry's
`test` function to source and grouping identical bodies finds **16 groups
covering 34 of 336 entries (10.1%)** — thirteen pairs and three triples, each
group made of entries with *byte-identical predicates*:

```
caught-out (social/common)              == caught-lying (oddity/common)
nobody-is-buying (capitol/rare)         == nothing-left-to-give (capitol/rare)
                                        == a7-every-bloc-spent (capitol/rare)
a-weapon-with-a-name (combat/common)    == the-named-blade (combat/common)
the-terms-were-the-terms (social)       == charter-kept (social)
debtors-crown (social/rare)             == debt-unsettled (social/rare)
                                        == unpaid-crown (social/rare)
arms-dealer (social/legendary)          == sold-the-arena (capitol/legendary)
heir-apparent (social/rare)             == the-heir (social/rare)
crown-limping (survival/legendary)      == walking-wounded (survival/legendary)
cartographer (arena/legendary)          == cartographers-apprentice (arena/legendary)
nothing-but-hands (combat/legendary)    == unarmed-all-year (combat/legendary)
the-token (reaping/common)              == a7-token-to-the-end (oddity/common)
foul-weather (arena/common)             == a7-three-storms (survival/common)
homecoming (reaping/rare)               == forgotten-district-crowns-one (reaping/rare)
unread (capitol/rare)                   == never-a-gift (capitol/rare)
all-volunteers (reaping/rare)           == a7-all-volunteer-crown (reaping/rare)
the-backlash (capitol/common)           == a7-failed-the-interview (reaping/common)
```

Only one group (`all-volunteers` / `a7-all-volunteer-crown`) carries an
`availableIn` guard, and both members carry the same one. Every other group is
unconditional and **always unlocks together**. The player is handed two or
three cards at the same moment, with different names, sometimes in different
categories, saying the identical thing:

- `the-token` ("Crown a victor still carrying the one thing they brought from
  home") and `a7-token-to-the-end` ("Crown a victor still carrying the token
  they brought from home") are both `(_s, v) => !!v && v.token !== undefined`,
  both measure 60.6%, and both appear in §11's near-automatic list as two
  separate problems.
- `debtors-crown` / `debt-unsettled` / `unpaid-crown` are three entries for one
  boolean, two of which are even near-synonyms in English ("Still Owed",
  "Still Owing").
- `arms-dealer` and `sold-the-arena` are `(v.intelSold ?? 0) >= 1` filed under
  two different categories, both labelled legendary.

Seven of the thirty-four carry the `a7-` prefix, so AUDIT-7's batch of seventy
re-authored seven entries the table already had — which is exactly what happens
when a roster grows past the point where an author can hold it in their head
and there is no check.

The real roster is **318 distinct achievements presented as 336**, and the
category counts in `ACHIEVEMENT_CATEGORIES` and the record book are all
inflated by the same 10%.

**Fix.** Two parts, and the second matters more.
1. Merge each group, keeping the better-named entry and the stricter category.
   `debtors-crown` and `nobody-is-buying` are the natural keepers of their
   triples.
2. **Add the guard to `check-achievements.ts`**, which already imports the
   whole table and already evaluates every predicate against hundreds of
   end-states. Two properties: no two entries may share a `test` source, and —
   the stronger version, which catches near-duplicates the source comparison
   misses — no two entries may unlock on identical sets across the sample.
   The second would have caught all sixteen of these and would catch the next
   one written.

**Addendum, from implementing it.** The source-identity half is the easy half
and it is not the whole problem. Once the sixteen source-identical groups were
re-gated, the behavioural half — same unlock set across a 500-run sample, with
a floor under it so coincidences do not fail the build — surfaced **sixteen
more groups the source comparison can never see**, among them a *third*
`named-blade` whose predicate differs only in punctuation. So the true figure
is not 16 groups and 34 entries but roughly **32 groups and 65 entries, a fifth
of the roster**, and the cheaper of the two checks finds half of it. Both are
needed, and the behavioural one is the one worth having.

Nine of the thirty-two had no reachable harder rung to be re-gated onto — the
ceiling guard proves it: `knownEdges >= 2` and `garrisonsFormed >= 2` are both
above anything 500 runs produce, which is §5.2 showing up from the other end.
Those are better deleted than re-gated into unreachability, and deletion is
safe: the record book only queries ids it knows, so a stale id in a player's
`unlocked` set is inert.

## 1.5 Nothing validates a cross-table reference anywhere in `data/`

§1.2 is one instance of a general gap. The repository has 2,364 guarded
balance knobs, a check that no knob goes unread, a check that no new tunable
is typed into the engine, a check that every `TraitMod` key is carried, and a
check that no achievement compares an optional boolean against a value it
never takes. It has **no check at all** that a string in one data table
resolves to a row in another.

The tables that cross-reference by string, and are unguarded:

| Reference | Sites | Status on this commit |
|---|---|---|
| `ArchetypeDef.preferredTraits` → `TRAIT_DEFS` | 35 rows, ~140 strings | **1 broken** (§1.2) |
| `ArchetypeDef.hatesArchetypes` → `ARCHETYPES` | 35 rows, 47 strings | clean |
| `INCOMPATIBLE_TRAITS` → `TRAIT_DEFS` | 81 pairs | clean |
| `QUIRK_MODS` keys → `QUIRKS[].label` | 105 | clean |
| `Arena.restockBias` → `ITEMS[].id` | 45 arenas | **unchecked** |
| `Arena.lawZone` → `Arena.zones[].name` | 10 arenas | **unchecked** |
| `Arena.eventPack` → `ARENA_EVENT_PACKS` | 45 arenas | checked by `test:arenas` |
| `Mutt.homeZone` → zone names (`siege` role) | 13 mutts | **unchecked** |
| `ARCHETYPES[].signature` → `SIGNATURES` | 35 | silently no-ops (`if (!fn) return`) |
| `TRAIT_PROFICIENCY_FLOOR` keys → `TRAIT_DEFS` | 3 | clean |

Four of those ten are unchecked and two of the four would fail silently in the
same way §1.2 did — a `restockBias` id that does not match an item simply
biases nothing, and a `lawZone` that does not match a zone silently makes
`noWaterExceptZone` into "no water anywhere".

**Fix.** One new check, `scripts/check-references.ts`, roughly sixty lines,
asserting every row of that table. Its value is not the one bug it finds today;
it is that this class of bug has now survived eight audits.

## 1.6 The water-source census measures the wrong thing, and thirteen arenas are dry — *corrected*

**This entry said something different in the first draft and was wrong. The
corrected finding is smaller, and the correction is the interesting half.**

`test:arenas` reports, as a note rather than a failure:

```
 -     a water source: 42/45 — missing: frozen warren silkwood
```

The first draft read that as three arenas with no drinkable water and proposed
declaring one in each. Checked against the resolver rather than the check, that
is wrong twice over.

The check tests `a.zones.some(z => z.features?.waterSource !== undefined)` —
whether a zone **explicitly declares** the field. But `zoneFeatures()` derives
it when absent, from terrain and name, and `frozen` and `silkwood` both resolve
water sources that way (`Frozen Lake`, `The Meltwater Channel`, `The Sink`). So
the note names two arenas that are fine and misses every arena that is not.

Resolving `zoneFeatures().waterSource` across all 470 zones, **thirteen of the
forty-five arenas have no drinkable water anywhere**: `toxic`, `tempest`,
`saltflats`, `warren`, `reef`, `abattoir`, `ashwaste`, `floe`, `seapeaks`,
`ashgrove`, `kelvin`, `menagerie`. Several are visibly made of water —
`tempest` has a kelp shallows and a tidal cave, `reef` has a trench.

And that is deliberate. **48 zones across 26 arenas explicitly declare
`waterSource: false`**, and every one of them is right to: sea water, brine
pans, coolant vats, sea ice, a flooded school pool. All four of `tempest`'s
water zones are salt; all four of `floe`'s are the ocean. The hydration
pressure in those arenas is the design, not a gap in it.

So there is no data bug here and nothing to fix in the arenas. What is left is
smaller and real:

- **The note is misleading** and will mislead the next reader exactly as it
  misled this one. It should measure `zoneFeatures(z).waterSource` — the thing
  the engine reads — and report the thirteen, not the three.
- **`Died of thirst within sight of the water` is unreachable in thirteen
  arenas**, which is a third of the roster and part of why it fires once per
  400 Games (§1.10). Worth knowing when re-gating it.
- `warren` is the one case worth a second look on its own merits: six zones,
  no water terrain, no foul-water declaration, nothing saying so out loud.

**Fix.** Change the census line in `validate-arenas.ts` to resolve rather than
read the raw field, and print the count. Change nothing in `data/constants.ts`.

## 1.7 Four of the ten zone-effect kinds cannot be produced by any procedural arena

`engine/arenaGenerator.ts:511`:

```ts
const SIGNATURE_EFFECT_KINDS: ZoneEffectKind[] =
    ['burning', 'flooded', 'frozen', 'contaminated', 'fogbound', 'stripped'];
```

`ZoneEffectKind` has ten members. `blooming`, `irradiated`, `quaking` and
`swarming` — the four added after the original six, and the four whose whole
argument was that the original set was all punishments and all temporary — are
not in the procedural signature's draw. A generated arena can never make ground
bloom, can never irradiate anything permanently, can never destabilise footing
and can never infest a zone through its own signature.

This shows in the live-instance census across 400 runs:

```
fogbound 2372 | stripped 1909 | flooded 1305 | burning 1286 | contaminated 1080
blooming 624 | frozen 511 | quaking 228 | swarming 170 | irradiated 102
```

23:1 between the commonest and the rarest. The four excluded kinds are four of
the bottom five. `blooming` is the exception because `regenerateZones` starts
one directly in `dayNight.ts` — which is the proof that the others would rise
too if they had a source.

**Fix.** Add the four to the array. `irradiated` is permanent and should
probably carry a lower draw weight rather than being excluded outright — a
weighted pick, not a uniform one.

## 1.8 Two of the thirty-six procedural signature combinations are inert, and one is near-inert

`rollSignatureRule` picks trigger, selector, payload and telegraph
independently and uniformly, with no compatibility filter:

```
6 triggers x 6 selectors x 6 payloads x 3 telegraphs = 648 combinations
```

`applySignaturePayload` (`arenaSignature.ts:1750`) shows that three of the six
payloads begin with `const present = tributesIn(ctx, zone); if (present.length
=== 0) return;`. Crossed with the `emptiestZone` selector:

| Payload | with `emptiestZone` |
|---|---|
| `spawnMutt` | **inert** — returns before engaging, no log line |
| `revealPositions` | **inert** — returns before the broadcast, no log line |
| `damageEffect` | hurts nobody; still starts the zone effect |
| `drainVital` | drains nobody |
| `severEdges` | works |
| `invertResources` | works |

So 2 of 36 (payload, selector) pairs produce **no observable output at all**,
and two more are half-dead. A generated arena drawing one of those has a
signature mechanic — the thing that is supposed to give it its identity — that
the player can never see fire. At a uniform draw that is 5.6% of generated
arenas fully silent and 11.1% more producing only a side effect.

**Fix.** Either make `selectSignatureZones` fall back to the busiest zone when
the chosen selector yields nobody for a people-payload, or filter the payload
draw by selector. The second is three lines and does not change any existing
seed's draw if the filter is applied after the pick with a re-pick.

## 1.9 Every procedural signature death carries the same sentence

`applySignaturePayload`'s `damageEffect` case writes exactly one cause string:

```ts
applyDamage(ctx, t, damage, { cause: `Caught by the arena in ${zone}`, kind: 'arena' });
```

Twelve biomes, twelve effect vocabularies (`rollEffectVocab` exists and renames
the primitives per biome), six draw-able effect kinds — and one obituary. A
tundra arena's signature death and a bayou arena's signature death are the same
line with a different zone name in it.

This is why `test:arenas`'s otherwise excellent "arenas that can produce a
death of their own: 45/45" is misleading: it is measuring the 45 hand-authored
arenas. The procedural path — which is one of 46 ids in every sweep, and is the
only arena a player gets when they pick "surprise me" — cannot.

**Fix.** The data to do this properly already exists. `effectVocab[kind].label`
is the biome's own word for the effect the payload is applying. A cause of
`Caught by the ${label} in ${zone}` costs one line and produces
6 effects × 12 biomes = 72 distinct obituaries in place of one.

## 1.10 `Did not wake` fires once in 400 Games; `Died of thirst within sight of the water` fires once in 400 Games

Universal-death reach, measured by cause substring across 400 runs:

```
Bled out                                 368 runs
Torn apart by <mutt>                     362
Went into shock                          119
Collapsed from exhaustion                 52
Took the nightlock                        35
Could not make the climb                  32
Died of sepsis                            31
Ate what they knew better than to eat     19
Struck down for defying the Gamemakers     2
Did not wake                               1
Died of thirst within sight of the water   1
Infested by <mutt>                         1
```

Three are effectively decorative:

- **`Did not wake`** (AUDIT-6 §7.2) is gated on `noRest || deadlyNight`, which
  is 38 of 400 runs, *and* `fatigue > 88` at night, *and* an 18% roll. The
  audit that added it argued "the law is universal and the death should be
  too"; it is reachable in 9.5% of runs and lands in 0.25% of them.
- **`Died of thirst within sight of the water`** (AUDIT-6 §7.2) is gated on a
  `waterSource` zone, *and* `thirst > 88`, *and* another living tribute in the
  same zone, *and* `fearOf(that tribute) >= 55`, *and* a 30% roll. The audit
  that added it called it "the cleanest expression of that model there is, and
  it was unreachable" — it is now reachable once per 400 Games, which is a
  different kind of unreachable.
- **`Infested by <mutt>`** is the `parasite` role's own death. There are
  **20 parasite mutts in the roster** and they produced one kill in 400 runs.
  The role's contract is "does not kill on contact — it attaches or infects,
  and the death resolves later through the ordinary vitals and medicine path",
  and the ordinary path is evidently absorbing all of it.

None of these is a crash. All three are content that was written, tested as
reachable, shipped, and is not in the game in any sense a player would
recognise. The pattern — *reachable is not the same as reached* — recurs in
§5, §6 and §7.

**Fix.** For each, remove one conjunct. `thirstNearWaterFear: 55 → 35` and
`thirstNearWaterThirst: 88 → 80` alone would bring the last one into double
figures. Then add a reach line to `soak.ts` for every `UNIVERSAL_DEATHS` cause,
the way the prose probes work: a death authored and never seen should fail the
build, not sit in a file.

## 1.11 `signalling` can only be trained by succeeding at the thing it gates — *proven*

`engine/intent.ts:179-183`, the entire training surface for the skill:

```ts
if (t.attributes.intelligence < PLANNING.falseTrailIntelligence) return;   // 6
const craft = profOf(t, 'signalling') + profOf(t, 'tracking') * PLANNING.falseTrailTrackingShare;  // 0.5
if (craft < PLANNING.falseTrailSkill) return;                              // 1.5
if (!ctx.rng.chance(PLANNING.falseTrailChance + profOf(t, 'signalling') * PLANNING.falseTrailPerSignalling)) return;
trainProficiency(t, 'signalling');
```

This is the **only** `trainProficiency(t, 'signalling')` call in the
repository. Four things follow from it, and together they are why the skill's
population mean is 0.01 and 99.6% of tributes never train it (§3.5):

1. `signalling` starts at 0 and has no entry in `TRAIT_PROFICIENCY_FLOOR`
   (which holds only `Climber`, `Swimmer` and `Trapper`), so there is no trait
   that grants a head start.
2. With `signalling = 0`, `craft` reduces to `tracking * 0.5`, so the floor of
   1.5 means **a tribute needs `tracking >= 3.0` before they are eligible to
   train `signalling` for the first time.**
3. `tracking`'s measured population mean peak is **1.24**, with 17.7% of
   tributes never training it at all. The entry condition is 2.4 times the
   mean of a *different* skill.
4. On top of that: `intelligence >= 6`, and a 30% roll.

So the skill is gated behind a bootstrap it cannot supply itself and a
prerequisite most of the field never reaches. `profOf(t,'signalling')` is then
read in two places in the same function — once in `craft` and once in the
success chance — meaning the skill's own effect on the gate is
`0.05 * 0.01 = 0.0005`, i.e. nothing.

The max observed level is 3.46, so it is not *impossible*: a handful of
high-tracking, high-intelligence tributes per thousand get on the ladder and
then climb it quickly. But 99.6% of the cast never takes the first rung, which
makes an authored axis of the proficiency system — added by AUDIT-7 §12.4 with
a correct diagnosis of the problem it was solving — effectively not in the
game.

**Fix.** Two lines. Drop `falseTrailSkill` to 0.5 (so `tracking >= 1.0` is the
entry, which is at the population mean), and move `trainProficiency` above the
success roll so *attempting* a false trail teaches it, at a partial share —
which is the `navigation` fix AUDIT-7 applied successfully in the same batch
and did not apply here.

`intimidation`, `oratory` and `readingPeople` are the same class of problem
with a different cause; see §3.5 and §12.4.

## 1.12 The tap-target ratchet exempts 39% of the controls it measures

`test:ui`, on this commit:

```
574 controls at 380px across 5 screens: 0 under 44px (ceiling 0),
0 under 24px (ceiling 0), 225 exempt (in-prose / dense-table)
```

The headline is genuinely good — AUDIT-6 took this from 155 failures to 5 and
AUDIT-7 took it to 0, and it has held. But **225 of 574 controls are exempt**,
and the exemption categories ("in-prose", "dense-table") are the two places a
control is *hardest* to hit, not easiest. The `roster tab` measures
`0/228 under 44px … 14 exempt`, while `chronicle` measures
`0/119 … 105 exempt` — 88% of the chronicle's controls are exempt from the
chronicle's tap-target check.

This is the AUDIT-7 §1.9 pattern ("ratchets with permanent slack") in a check
that otherwise reads as a total pass. It is not a bug today. It is a number
that can only go up, with nothing watching it.

**Fix.** Ratchet the exempt count the same way the failure count is ratcheted:
record 225 as the ceiling and fail on 226.

## 1.13 Risk register — not bugs, one edit away from being bugs

- **`runArchetypeSignatures` silently no-ops an unknown key.**
  `const fn = SIGNATURES[key]; if (!fn) return;` — a renamed signature
  function removes an archetype's set piece with no error anywhere. All 35
  resolve today. Assert it at module load.
- **Eleven `eslint-disable react-hooks/exhaustive-deps`** remain, five of
  them in `GameScreen.tsx`. They now suppress a rule that runs, which is
  strictly better than AUDIT-7's finding, but `GameScreen`'s keyboard effect
  closes over `filters`, `watched` and `sortedRoster` behind one of them.
- **35 `as any`/`: any` casts** in `src/`, in a codebase with zero
  `@ts-ignore`. Not alarming; worth a ceiling.
- **`Arena.mutts` and `Arena.events` are documented as flavour-only** and are
  still typed as the same `string[]` the engine used to read. Two fields that
  look load-bearing and are not.
- **`test:unnamed` sits at 4.3% against a 4.0% baseline** — 892 lines in
  20,745 leave a participant unnamed. Passing, but drifting up, and the
  worst offenders are all in the `training` and `alliance` categories.

---

# §2 — All QOL, UI and UX updates needed

The interface is in the best state of any audit so far: `test:ui` is 52/52,
`test:ui-affordances` is at a hard zero on both its ceilings, every control
clears 44px at phone width, there is no horizontal overflow at 380px, dark
mode and three palettes exist, and the router supports deep links and
back/forward. What follows is what is left, ordered by how often a player
would hit it.

## 2.1 Twenty keyboard shortcuts, none remappable — *unchanged since AUDIT-7 §2.4*

`GameScreen.tsx:422-520` binds `Space F M C S ? Esc Z T O X D [ ] I P 0` and
`1`–`9` directly off `e.key`, with a separate `Cmd/Ctrl+K` in
`CommandPalette.tsx`. There is no indirection: no keymap object, no preference,
no way to change any of it.

This is a genuine accessibility gap rather than a nicety. `[`/`]` require a
modifier on most non-US layouts; `?` requires Shift on all of them; a
single-handed player cannot reach `Space` and `Shift+D` together for
reverse-death-jump. The help overlay teaches the map, which makes it
discoverable and still unchangeable.

**Fix.** Lift the bindings into `data/shortcuts.ts` as
`Record<CommandId, string[]>`, resolve through it, and add a
`Record<CommandId, string>` override to `Prefs` (which already persists
through the versioned envelope and is already covered by
`check-storage-migrations`). The command palette already enumerates every
command by id, so the remapping UI is a list it can render for free.

## 2.2 There is still no text-size or density preference — *unchanged since AUDIT-7 §2.3*

`Prefs` carries `units`, `palette`, `theme`, `spoilerSafe`, `seenCoachMarks`,
`muteAudio`, four `pauseOn*` brakes, `phasePacing`, `reduceMotion`,
`seenShortcutHint`, `arenaBriefingOnDrop` and `fullscreenOnStart` — thirteen
fields and no type scale.

The chronicle's `FeedDensity` (`everything` / `scenes` / `headlines`) is a
*content* filter, not a *reading* one: it decides which lines exist, not how
big they are. A game whose primary output is 914 log lines per run, read in a
scrolling column, with a body size fixed in the stylesheet, has a reading
comfort problem that no amount of filtering solves.

**Fix.** One `fontScale: 0.9 | 1 | 1.15 | 1.3` on `Prefs`, applied as a
`data-scale` stamp on `<html>` exactly the way `palette` and `theme` already
are (`applyPalette`/`applyTheme` are the pattern, and they are three lines
each). Every size in `index.css` that is not already relative becomes `rem`.
Add a `compact`/`comfortable` line-height pair on the same switch.

## 2.3 The betting step degrades to a note instead of a failure

`test:ui` prints, mid-run:

```
   (no stake controls — bets closed for this phase)
✓ betting deducts and refunds coins
```

The step passes by not finding the thing it is testing. Whatever phase the
harness happens to be in when it reaches that step decides whether the bet is
exercised. That is a check that will silently stop covering the betting layer
the first time phase pacing changes.

**Fix.** Drive the harness to a phase where bets are open before the step, and
fail if the controls are absent.

## 2.4 No screen in the application restores a reading position

There is exactly one `scrollTo` in `src/`, in `ChronicleScreen.tsx:302`, and
it scrolls the reader **to the top**. There is no `scrollIntoView` outside the
chronicle's `focusLogId` jump and no scroll restoration anywhere.

The chronicle at least has `focusLogId`, day paging and nine filter axes, so a
reader can get back to a place by naming it. The other long-scrolling
surfaces have nothing: `HallOfFameScreen` (501 lines), `RosterScreen` (465)
and `PanemRecordBook` (444) all reset to the top on every mount. A player who
opens a tribute from the Hall of Fame and comes back lands at the top of a
336-entry achievement list.

**Fix.** The `chronicleStore` pattern generalises: one `scrollMemory` record
keyed by route, written on unmount and applied on mount. The router already
knows the route.

## 2.5 Smaller items, each cheap

- **No "what changed" on the settings panel.** `resetPrefs()` exists and is
  destructive; there is no confirmation and no undo. The hint text says
  "(takes effect next run)", which is a warning that a click has consequences
  the screen cannot show.
- **`fullscreenOnStart` defaults to `true`** and is honoured on the reaping
  click. On a desktop browser this takes the player out of their tab layout
  without asking, on the single click that also starts the run. Defaulting a
  viewport takeover to on is unusual; at minimum the coach-mark layer should
  mention it once.
- **The epithet is shown in three places and explained in none.**
  `TributeModal` renders it with a `Named on cycle N` title, `TributeTile` and
  `StandingsTable` render it bare. It is awarded to 8.2% of tributes and there
  is no glossary entry saying what it is or that it is permanent.
- **`spoilerSafe` suppresses death and kill text and the odds board** but not
  the standings table's alive count, the fallen strip, or the arena map's
  emptying sectors. A spoiler-safe viewer can still count the survivors.
- **No export of a single tribute's story.** `ChronicleExport` exports the
  run; `TributeSummary.ts` builds a per-tribute narrative that is only
  rendered into the modal. The most shareable artefact the game produces has
  no share button.
- **The command palette has no recent-commands memory.** It enumerates every
  command every time, ranked by text match only.
- **`Hint`/`Explainer`/`Glossed`/`CoachMark` are four separate disclosure
  components** (`src/ui/disclosure.ts` plus three components). They have
  different keyboard behaviour and different dismissal semantics. This is
  invisible to a player until they try to dismiss one with Escape.

---

# §3 — Tribute logic: updates, robustness, more complexity

## 3.1 Decision quality is stable and the two headline numbers have not moved

```
decision quality over 40 runs, 7,566 tribute-cycles
trace present:       100.0% (forced 7.9%)
stance held = best:  55.6%
stance rank histogram: 0:55.6%  1:19.2%  2:12.4%  3:12.7%
destination = best:  66.0%
destination in bottom fifth of its own scoring: 3.6%
```

AUDIT-7 §3.1 reported these and flagged that the most-drifted number was
unguarded. `check-decisions.ts` now guards them and they hold. 12.7% of
stances landing outside the top three is the interesting residue: some of it
is hysteresis (`stanceChurn`, `stanceCooldown`, `stanceReady` all deliberately
resist switching) and some is the conditional-stance precondition filter. The
two are not distinguished in the trace, so it is not currently possible to say
whether a bad-looking pick was a deliberate hold or a bad pick.

**Add** a `held` / `filtered` / `forced` / `scored` tag to `DecisionTrace`, so
the histogram can be read as four populations instead of one.

## 3.2 The objective ladder is eight wide and the bottom three share 4.8%

Measured over 400 runs (live objective per tribute-cycle):

```
survive  38.0%      protect   7.3%
reach    22.1%      flee      5.7%
hunt     22.1%      stalk     2.1%
                    hold      1.9%
                    wait      0.8%
```

The soak's own figures across a different config sweep agree closely
(`survive=25.3% reach=27.4% hunt=24.4% flee=7.4% protect=9.7% hold=2.5%
stalk=2.2% wait=1.1%`).

`hold`, `stalk` and `wait` together are under five per cent. AUDIT-7 §3.4
reported the same shape and AUDIT-6 §12.5 added three archetypes specifically
to give `wait` a constituency. It did not work, and §1.1 explains part of why:
`quiet` nominally biases `stalk` at 0.4 and produces it 4.9% of the time,
because the cascade's earlier tiers (thirst, hunger, a hostile in the zone)
fire first almost every cycle.

The problem is structural rather than one of weights. `chooseObjective` is a
priority cascade: the top tier that matches wins. The three rare objectives are
all *discretionary* — they are what a tribute does when nothing is pressing —
and the vitals curve means something is pressing most cycles.

**Fix.** Give the three discretionary objectives a *tier of their own above
the errands*, gated on a "nothing is urgent" predicate, rather than leaving
them to lose to `reach: water` forever. A tribute who is fed, watered, rested
and unthreatened should be choosing between `hold`, `stalk` and `wait`, not
re-deciding to survive.

## 3.3 The objective queue is still depth-1 in practice

AUDIT-7 §3.2 proved `PLANNING.queueDepth: 2` unreachable. The type still says
depth two (`objectiveQueue?: Objective[]`, "depth two — anything deeper is a
planner rather than a person") and `StandingGoal` was added as a third slot
behind it. `StandingGoal` works — `reason: 'feast' | 'avenge' | 'endgame'` —
and it is the only thing that ever sits behind the current objective.

So the shape is: one live objective, one standing goal, and a queue that is
declared and empty. Either fill the queue or delete it; a field that is
written by nothing is the bug `TraitMod`'s header comment exists to prevent,
applied to intentions instead of modifiers.

## 3.4 The stance roster is twelve wide and the bottom seven are 9.5%

Measured over 400 runs, 84,580 tribute-cycles:

```
Defensive   37.0%      Shadowing   2.3%
Evasive     25.7%      Baiting     1.9%
Aggressive  20.5%      Desperate   1.2%
Fortified    5.0%      Nursing     1.2%
Hunting      2.4%      Scavenging  1.0%
                       Tending     1.0%
                       Patrolling  0.9%
```

`metrics.ts` at n=1,600 reports the same ordering with Evasive and Defensive
swapped (35.4% / 14.2%), which is a config-sweep difference, not a
contradiction — the metrics sweep runs larger fields.

The three unconditional stances hold 83% of all stance-time. That is the same
ratio AUDIT-7 §3.3 reported (80%) with two more stances added since. The two
newest — `Tending` (1.0%) and `Baiting` (1.9%) — landed exactly where AUDIT-7
predicted a new stance would land ("about 1.5% unless it takes share from
somewhere specific").

`Baiting` is the more interesting failure, because it was added to give
fieldcraft's untriggered traps a purpose. Measured: 1,151 traps set, 323
triggered — **71.9% of traps in the game never close on anybody**, unchanged
from the 72.7% AUDIT-7 quoted as the motivation for the stance. The stance
exists, fires 1.9% of the time, and has not moved the number it was written
for.

**Fix.** `Baiting`'s precondition should read the tribute's own trapline —
a tribute with two or more of their own traps in an adjacent zone, and a known
hostile within two zones, should be strongly biased into it. At 1.9% it is not
being offered often enough to matter; the trap conversion rate says it is not
being offered to the right people.

## 3.5 Seven of nineteen proficiencies are effectively not in the game

Mean peak level per tribute and the share of tributes who never train it at
all, over 7,640 tributes:

```
skill           mean peak   max    never trained
stealth          1.85       6.00      33.2%
melee            1.77       6.00      21.9%
persuasion       1.47       5.66      17.9%
tracking         1.24       4.88      17.7%
forage           1.17       4.91      18.4%
navigation       1.05       4.08      32.9%
medicine         0.79       4.95      39.3%
ranged           0.78       5.79      44.7%
crafting         0.68       5.87      72.7%
climbing         0.57       5.12      70.8%
carpentry        0.36       3.82      72.9%
swimming         0.32       5.33      82.8%
butchery         0.26       4.63      84.0%
fieldcookery     0.25       5.97      87.9%
pacing           0.22       2.82      62.8%
oratory          0.12       3.38      91.0%
readingPeople    0.10       2.54      88.3%
intimidation     0.08       2.33      91.7%
signalling       0.01       3.46      99.6%
```

**`signalling` is untrained by 99.6% of tributes and its mean peak is 0.01.**
It was added by AUDIT-7 §12.4, with the stated justification that
`intent.ts`'s false-trail gate "reads raw `intelligence` plus `tracking` doing
borrowed duty". The diagnosis was right and the training site it shipped with
is self-gating — §1.11 proves it. Four of AUDIT-7's four new proficiencies sit at
the bottom of this table (`signalling` 99.6%, `readingPeople` 88.3%,
`fieldcookery` 87.9%, `pacing` 62.8%).

`intimidation` (91.7%) and `oratory` (91.0%) are AUDIT-6 additions in the same
state. The pattern across two audits is consistent: **a proficiency added with
exactly one read site gets exactly one training site, and one training site is
not enough to move a skill that starts at zero and caps at 6.**

This matters more than it sounds, because `profOf()` is read in gates
throughout the engine. A skill whose population mean is 0.01 is a gate that is
always closed.

The training-site census, for the four worst, is the rest of the explanation:

| Skill | `trainProficiency` sites | How often the site occurs |
|---|---|---|
| `signalling` | **1** — and it is self-gating (§1.11) | requires `tracking >= 3.0` |
| `readingPeople` | 1 — the bluff, in `parley.ts` | 166 bluffs per 400 runs |
| `intimidation` | 2 — a training-floor beat and the standoff | 76 standoffs per 400 runs |
| `oratory` | 3 — the herald's signature and two bloc-treaty speakers | 244 treaties per 400 runs |

Against a field of ~19 tributes per run, 76 standoffs across 400 Games is one
opportunity per 100 tributes. A skill with one low-frequency training site
cannot leave the floor, however good its read site is.

**Fix, in three parts.**
1. Fix `signalling`'s self-gate (§1.11) first — it is the only one of the
   seven that is structurally untrainable rather than merely under-trained.
2. Adopt the `navigation` fix as the pattern: AUDIT-7 gave it a partial share
   on *arriving in a new zone*, a thing every tribute does many times, and it
   went from "peak 2.53 across 6,000 tributes" to a 1.05 mean with 67% of the
   field trained. Every dead skill needs one high-frequency partial-share site,
   not one low-frequency full site.
3. Add a proficiency-coverage line to `metrics.ts` with a floor. The three
   audits that added skills all checked the read site and none checked the
   population.

**Measured after implementing 1 and 2** — `signalling`'s floor lowered and the
attempt made to teach, plus one high-frequency partial site each for
`intimidation` (every point of fear inflicted), `oratory` (every charter sworn
and every hearing convened) and `readingPeople` (every parley attended): the
field's **best proficiency mean went 3.15 -> 4.04** at n=1,600. That is the
whole population moving, not four skills moving, which is the point — these
axes are read in gates all over the engine and a population mean near zero is
a gate that is always shut.

## 3.6 What is solid and should not be touched

- **The wound model.** Graded severity per site, per-site infection with its
  own incubation clock, `woundAge`, `recoveryProgress`, scarring at grade 2,
  `bleedOpenedById` so a cut has an author. `infection: woundsTurned=411
  deepened=146 reachedTerminal=33 treated=182 sepsisDeaths=26` over 400 runs
  is a system in balance.
- **The downed window.** 1,495 tributes went down, 605 were pulled back, 427
  were finished where they lay. A third of the field experiences a state that
  did not exist four audits ago, and the three outcomes are genuinely
  contested.
- **Fear as per-target state.** 70,061 fear ledger entries per 400 runs, with
  5,092 of them accrued without any contact at all via the notoriety channel,
  and 936 strangers known by name. This is the deepest thing in the tribute
  layer.
- **Trait arcs.** 3,619 traits shed or transformed across 1,600 runs, with all
  three named arcs firing (`pacifistToBroken=40 loyalToTreacherous=8
  mercifulToRuthless=54`). `loyalToTreacherous` at 8 is thin but it is
  supposed to be.

---

# §4 — Tribute relationships and alliances: improvements and updates

## 4.1 The eight alliance roles are two populations, and the split is exactly where AUDIT-6 left it

Measured over 9,684 alliance-samples of size two or more:

```
muscle         95.0%
medic          89.4%
---------------------
scout          43.8%
quartermaster  42.8%
face           38.1%
watch          38.1%
keeper         38.1%
runner         37.7%
```

AUDIT-6 §4.2 measured `muscle 96.5% / medic 90.8%` against `scout 48.1% /
quartermaster 46.8%`, called it "two useful roles", and added four more. The
four it added all landed at 38%, and the two it complained about have not
moved. The population is now 2 near-automatic and 6 coin-flips, which is a
larger version of the same shape.

The three at exactly 38.1% (`face`, `watch`, `keeper`) is not a coincidence —
it is the signature of a shared gate. They are assigned from a common
minimum-group-size condition rather than from any per-role merit.

**Fix.** Roles should be *competed for*, not filled. The interesting question
inside a group of five is not "does this group have a quartermaster" (43%) but
"which of us is it", and the answer should move: a `keeper` who defaults on a
debt should lose the role, a `scout` who walks the group into an ambush should
lose it, a `face` who loses a parley should lose it. `Alliance.roles` is a
`Partial<Record<AllianceRole, string>>` reassigned on formation and never
again; a `reassignRoles` pass on the same clock as `enforceCharters` would
make eight static labels into eight contested positions at the cost of one
function.

## 4.2 Alliance politics fires, but the interesting half of it does not

```
politics: factionActions=587 (coups=15 expulsions=203 walkouts=369)
          charterExpulsions=205 hearings=9
§4: coalitionFractures=8 inheritances=1220 mentorCrossTalk=80 watchesPosted=94
succession: toNamedHeir=88 heirPassedOver=12 splitTheGroup=13 noHeirNamed=85
```

Per 400 runs. Three numbers stand out:

- **`hearings=9`.** The charter system's entire middle ground — "fallout short
  of a full betrayal: an argument, a lost night's trust… the whole middle
  ground the alliance layer was missing" — convenes nine times in four hundred
  Games, against 205 charter expulsions. The group skips the hearing and goes
  straight to throwing somebody out 96% of the time.
- **`coups=15` against `walkouts=369`.** `Faction` is a well-modelled object
  (`memberIds`, `againstId`, `formedCycle`, `heat`) that resolves into a
  walkout 96% of the time. The coup — the payoff the faction exists for — is
  4%.
- **`noHeirNamed=85` against `toNamedHeir=88`.** AUDIT-7 §4.4 reported
  "succession names no heir in half of all groups". It is still half.

`leaderStyle` was added to give the leader's role meaning, and measures
`democratic 7130 / tyrant 2095 / absent 459` — 74% democratic. The `absent`
style, added specifically because "6 heirs passed over and 11 groups split in
400 runs… are what happens when the person nominally in charge has not been
deciding anything", is 4.7% of groups.

**Fix.** The hearing is the right mechanic and its gate is too tight. It
should be the *default* response to a first breach (`breachesBy` already logs
per member, and the comment on that field says "so a *second* one is a
hearing") and expulsion the response to a second. Invert the current ordering
and the numbers swap.

## 4.3 Truce reasons are healthy; the pair layer is the best part of the social model

```
truceReason = {mutual-threat 3516, brokered 2766, both-wounded 1749, extortion 1490}
truce ledger (engine): terms=950 endings=950
  (renewed=206 lapsed=182 turned=51 broken=27 outlived=429 buried=39
   dissolvedWithBroker=16 standingAtEnd=0) unaccounted=0
```

Four reasons all in four figures, every ending accounted for, nothing left
standing at the end of a run. AUDIT-7's complaint that "90% of truces
evaporate without resolving into anything" is fixed: `lapsed` is 19% and
`renewed` is 22%.

The same is true of the loan ledger (`made=390 accountedEndings=390`,
`unaccounted=0`) and the vengeance ledger (`sworn=394 accountedEndings=394`).
Three ledgers that close is unusually disciplined bookkeeping and is why this
section has fewer findings than §4 of any previous audit.

## 4.4 Performed bonds are 0.26% of tribute-cycles

`displayedRegard` — the star-crossed strategy, "what a tribute is *performing*
toward someone, as distinct from what they actually feel" — was populated on
220 tribute-cycles out of ~84,600 across 400 runs. The metrics sweep reports
`runs with star-crossed lovers 17.1%` and `performed=57` per 400 runs.

So the sincere bond happens in one run in six, and the performed one — which
is the canon version, and the mechanically richer one, since it earns the
sponsor benefit without the loyalty — happens 57 times. `performingStreak`,
`maxPerformingStreak` and `state.longestPerformance` are three fields tracking
a thing that barely occurs.

**Fix.** The decision to perform a bond should be available to the *interview
angle* layer, which already has `showmance` as one of five angles and produces
it 318 times per 400 runs (§10.2). A tribute who sold a showmance to Caesar
and then meets their co-star in the arena should open with `displayedRegard`
rather than having to arrive at it.

## 4.5 The bloc layer's endings are lopsided

```
blocTreaties: sworn=244 renewed=15 brokenByAKilling=3 lapsed=21
              endedByTheField=9 outlivedASide=188 narratedEndings=221
```

77% of bloc treaties end because one side died. 6% lapse, 6% are renewed, and
**a treaty between two groups is broken by a killing three times in four
hundred Games.** AUDIT-7 §4.5 measured "80% by attrition"; it is 77%.

A treaty that can only end by attrition is not an agreement, it is a
description of who is still alive. The `strainedCycle` field exists on the
treaty object and there is no measured path from strained to broken.

**Fix.** `oratory` — the proficiency added specifically for "the one mechanic
where a single tribute's word binds people who are not present" — is untrained
by 91% of the field (§3.5). The bloc treaty reads a skill nobody has. Fixing
the skill fixes the renewal rate; adding a `strained → broken` transition on
`heat` (which `Faction` already models, for the intra-group case) fixes the
breaking rate.

## 4.6 Fourteen of thirty-five archetypes are hated by nobody

`hatesArchetypes` in-degree, counted across all 35 rows:

```
beast 5 | career 5 | ghost 4 | mercenary 4 | zealot 4 | opportunist 3
wildcard 2 | scavenger 2 | saboteur 2 | protector 2 | captor 2 | diplomat 2
confessor 2 | underdog 1 | tracker 1 | strategist 1 | trickster 1
bellwether 1 | broker 1 | martyr 1 | herald 1

hated by nobody (14): survivalist, medic, scholar, quartermaster, warden,
  penitent, forager, duellist, cartographer, debtor, forecaster, understudy,
  archivist, quiet
```

And three archetypes hate nobody: `herald`, `forager`, `quiet`. AUDIT-7 §8.5
reported two; the batch it added made it three.

The antipathy graph covers the original fifteen archetypes densely and the
twenty added since barely at all. Every archetype added after the first batch
is socially inert in both directions: nobody dislikes an Archivist on sight,
and a Quiet Professional dislikes nobody on sight.

**Fix.** This is pure data. Twenty rows to edit, each needing one or two ids.
A suggested pass, chosen so the new edges are *reciprocal-adjacent* rather
than arbitrary:

| Archetype | should hate | should be hated by |
|---|---|---|
| survivalist | `career` | `forager` (competes for the same ground) |
| medic | `beast` | `zealot` |
| scholar | `beast` | `duellist` |
| quartermaster | `scavenger` | `debtor` |
| warden | `opportunist` | `ghost` |
| penitent | `career` | `confessor` |
| forager | `career`, `scavenger` | `survivalist` |
| duellist | `ghost` | `trickster` |
| cartographer | `saboteur` | `tracker` |
| debtor | `broker` | `quartermaster` |
| forecaster | `wildcard` | `archivist` |
| understudy | `bellwether` | `martyr` |
| archivist | `wildcard` | `forecaster` |
| quiet | `herald`, `showman-types` | `warden` |
| herald | `quiet` | `penitent` |

## 4.7 What is working and should not be touched

- **Trust as a third stored axis** (`trusts`), decaying on its own clock, with
  `trustOf` still derived so every save reads. Measured: 245 investigations
  (169 guilty, 112 preemptive departures, 57 nights slept apart).
- **Perceived bonds** (`memory.perceivedBonds`) — the field learning who would
  come for whom.
- **Reconciliation.** 1,176 reconciliations per 400 runs against 135 feuds.
  Rivalry has a way down as well as up, which almost no simulation of this
  kind bothers with.
- **Love triangles.** 514 formed, 365 jealousy beats, 98 forced choices, with
  a hard resolution at `RESOLVE.endgameFieldSize`. 86.5% of runs contain one.

---

# §5 — Arena updates, robustness, more complexity

## 5.1 The authored layer is complete, and that remains the finding

```
authored-layer coverage across 45 arenas:
    own event pack: 45/45      cornucopiaLayout: 45/45
    effectVocab:    45/45      off-season skins:  45/45
    restockBias:    45/45      a water source:    42/45  (misleading; see §1.6)
    arenas on the universal Gamemaker pack: 0 (ceiling 0)
    arenas that can produce a death of their own: 45/45
zone interiors: 470/470 authored, 176 vertical, 373 acoustic, 309 shelter
```

Every hand-authored arena carries every optional layer. `test:zone-features`
confirms 470 of 470 zones declare their own interior rather than deriving it.
This is the third consecutive audit at which the authored roster is complete,
and it means arena work should now go into the *procedural* path and into
*depth per arena*, not breadth.

## 5.2 84% of the map is still plain adjacency — *unchanged since AUDIT-7 §5.2*

103 edge rules across 641 undirected edges = **16.1%**. Kind distribution:

```
tolled 28 | contested 25 | hidden 15 | collapsing 13 | timeGated 9
oneWayAfter 8 | oneWay 5
```

And the reach of the rarer kinds, over 400 runs:

```
runs where any hidden edge was known to anybody   14.8%
runs where any edge was garrisoned                19.3%
edge crossings counted                            214 (per 400 runs)
hidden edges found                                100
```

Fifteen authored hidden edges — described in the type comment as "a way nobody
has found yet is worth more than any of them" — are discovered in one run in
seven. `garrisonRuns=53 garrisonCycles=183` means the `contested` edge, the
mechanic that makes a pass worth sitting on, is live in 13% of runs for an
average of 3.5 cycles.

**Fix.** Two separate problems.
1. **Density.** 16% is too low for edge rules to be part of how an arena
   reads. The procedural generator can roll them (it knows structurally which
   zone is a chokepoint, which is why `chokepointByName` was lifted into
   `models/types.ts`) — have it roll 20–25% and the hand-authored roster will
   stop being the only place they exist.
2. **Discovery.** `tickHiddenEdges` gates on sitting still; `navigation` was
   wired to hidden-edge discovery by AUDIT-6 and now has a 1.05 population
   mean (§3.5). 14.8% is the product of a rare gate and a weak skill. Let an
   ally *tell* you about a hidden edge — `knownEdges` and `sharedIntelWith`
   both already exist, and the intel-sharing tick runs every cycle.

## 5.3 A run shows about an eighth of its arena's authored pack

```
arena events: 4.9 distinct authored events fired per run (floor 3.5)
  thinnest per run: procedural 0.4, seapeaks 0.8, eclipse 1.0,
                    labyrinth 1.2, saltworks 1.5
authored arena events total: 1,542 across 45 packs (mean 34.3)
```

4.9 of 34.3 is **14.3%**. AUDIT-7 §5.4 reported "about a third"; the packs have
since grown from 24 to 33+ while the per-run draw has not, so the share has
fallen. The floor (3.5) is on the sweep-wide mean and is well-argued in
`soak.ts`'s header, but it is a floor on *how many*, not on *what share*.

`procedural 0.4` is the number to worry about: a generated arena shows less
than one authored event per Games.

**Fix.** Raise the per-run draw rather than the pack size. The packs are deep
enough; the problem is that a Games spends 85% of its authored-event budget on
the universal pool. `ENCOUNTERS.ambientArenaShare` and the arena-event tick
rate are the two knobs.

## 5.4 The set-piece packs are all exactly seven

Every one of the forty-five `ARENA_EVENT_PACKS` holds exactly seven events:

```
tempest:7 saltflats:7 sporefields:7 canopy:7 vault:7 warren:7 islands:7
eclipse:7 reef:7 abattoir:7 carnival:7 ashwaste:7 quarry:7 glacier:7 floe:7
alpine:7 terraces:7 seapeaks:7 canopyweb:7 acousticforest:7 burnscar:7
craterfield:7 culdesac:7 labyrinth:7 ashgrove:7 kelvin:7 silkwood:7
nooneplace:7 redcathedral:7 menagerie:7 storywood:7 cabin:7 magmatube:7
karst:7 clockwork:7 frozen:7 concrete:7 toxic:7 solar:7 ashfall:7
tidewrack:7 thresher:7 vigil:7 saltworks:7 kiln:7
```

Forty-five independent creative decisions that all arrived at the same number
is not a creative decision; it is a template being filled. With "at most two
fire in a run, plus the convergence", a player sees 2 of 7 — 29% — and the
seven are the same seven every time they play that arena.

This is §10.1's pattern (authoring to the floor) showing up as authoring to a
*template*. It is the single clearest place the arena layer is shallower than
it looks.

**Fix.** Vary the pack sizes deliberately — a small arena like `warren` (6
zones) can justify five; `menagerie` (13 zones) should carry twelve. And raise
the per-run draw from two to a range (2–4) scaled by run length, so a
fourteen-day Games in the Menagerie is not the same three beats as a nine-day
one.

## 5.5 Terrain coverage is lopsided and one terrain is unused by the authored roster

Zone terrain across all 470 authored zones:

```
ruins 119 | open 101 | highland 70 | forest 67 | water 60 | wetland 39
desert 7 | urban 4 | cave 3 | ice 0
```

**No hand-authored zone in any of the 45 arenas uses `ice`.** It is reachable
only through the procedural generator's tundra/glacier bands. `cave` is three
zones, `urban` four, `desert` seven — against `ruins` at 119.

`terrainPreference` on a `Mutt` is a hard filter, and `test:arenas` asserts
"every terrain an arena is made of covered by at least one mutt that can
appear on it" — which passes precisely because no authored arena is made of
ice, so the assertion never asks.

The four terrains added as "first-class" by §10 (`cave`, `ice`, `desert`,
`urban`) total 14 authored zones between them, 3% of the map.

**Fix.** Three arenas in the roster are ice arenas by name and theme —
`frozen`, `glacier`, `floe` — and none of them has an `ice` zone. That is a
one-session data pass. `cave` belongs in `karst` and `warren`; `urban` belongs
in `concrete` and `culdesac`.

## 5.6 Robustness: what is solid

- **Stacked laws.** Seventeen distinct stacked-law combinations, each played
  to completion and asserted in force, including three-law stacks
  (`dawnMercy+noWeapons+theBell`, `noCannons+noNight+noSponsors`). 23 laws, all
  used, none orphaned.
- **Zone recovery.** `runsWithDepletion=294 runsWithRecovery=285
  peakDepletion=0.90 (floor 0.90) atFloor=0.7%` — ground gets stripped and
  comes back, and almost nothing sits permanently at the floor.
- **Layout.** 165 arenas laid out, minimum node separation 74px at 16 zones,
  zero label collisions, 46px zone touch targets at the minimum graph width.
- **The convergence and the muster.** Called in 73% of runs, attended in 176 of
  195 calls, 1,619 tribute-cycles paid. The mid-game gap the last two audits
  identified is closed.

---

# §6 — Small and side features: updates, robustness, complexity

Reach of every side system, over 400 runs — the share of Games in which the
system occurred at all:

```
rumour             92.5%      loan               47.5%
hornHolder         87.0%      abandoned camp     45.5%
triangle           86.5%      bloc treaty        34.3%
faction            85.0%      bounty             30.0%
vengeance pact     80.5%      garrisoned edge    19.3%
trap               80.5%      off-season skin    17.3%
muster             73.0%      hidden edge known  14.8%
                              Quell              25.3%
```

Nine systems above 45%, four below 35%. The four at the bottom are the ones
this section is about.

## 6.1 Fieldcraft builds four traps for every one that closes

```
fieldcraft: trapsSet=1151 trapsTriggered=323 fires=558 shelters=1335
            camouflage=164 poisonedWeapons=172
traps by kind: deadfall=415 pit=300 snare=202 stake=136 tripwire=98
live samples:  deadfall=783 pit=432 snare=247 tripwire=182 stake=177
```

**71.9% of traps never trigger.** The kind spread is 4.2:1 (deadfall to
tripwire), improved from AUDIT-7's 14:1 but still lopsided in the wrong
direction: `tripwire` is described in the type comment as "the more valuable
of the two for anybody hiding" and is the least built.

`camouflage=164` against `shelters=1335` is the other imbalance — 8:1 —
and camouflage is the one camp property that interacts with the stealth layer.

**Fix.** Trap conversion is a placement problem, not a construction problem.
`Trap.zone` is chosen where the builder is standing. A trapline should be laid
on the *approaches* — the builder's zone's adjacency, weighted by
`zoneTraffic`, which is already tracked and already decayed. That is one
function and would roughly double conversion.

## 6.2 The rumour economy is one-sided

```
rumours: true claims by kind restock=58 holed-up=368 cache=121 empty=96
rumours: planted=229 exposedAsPlant=109 exposedAsRepeated=37 untraceable=80
intel: lies=263 shares=1143
```

Two observations:

- **`holed-up` is 56% of all true rumours** and `restock` is 9%. One of four
  kinds carries the majority of the layer.
- **Honest intel outnumbers lies 4.3:1** (1,143 shares to 263 lies). The
  `liedTo` path exists, `checkIntelLies` runs every cycle, and the whole point
  of modelling belief separately from truth is that poisoning it should be
  worth doing. At 19% of all intel movement it is a garnish.

**Fix.** Lying should be *cheaper* than it is and the payoff more legible. A
tribute who successfully misdirects someone into a dangerous zone should get a
measurable return — `zoneDeaths` is tracked, `addZoneThreat` exists, and
nothing currently credits the liar when the lie works.

## 6.3 Bluffs and standoffs remain rare enough to be invisible

```
bluffs: landed=74 caught=92
parley: standoffs=76 tributesPaid=62 paidInInformation=30
```

76 standoffs across 400 Games is one per five runs. AUDIT-7 §6.4 made the same
observation. The gate is `readingPeople` — added by AUDIT-7 §12.4 precisely
for "telling a bluff from a threat" — which 88.3% of tributes never train
(§3.5). Same root cause as §4.5.

## 6.4 Items: 70 objects and the tail is invisible

Items observed in end-of-run inventories across 400 runs, bottom of the table:

```
Foraged Berries 2 | Capitol Lamb Stew 5 | Fire-Hardened Stake 5
Leather Sling 5 | Goat Cheese 12 | Venom Vial 13 | Wire 16
Loaf of Bread 11 | Burn Ointment 17 | Reed Spear 20 | Rope 21
```

against the top:

```
Sharpened Stone 373 | Trident 266 | Bow and Arrows 240 | Sword 237
Mace 223 | Axe 205 | Spear 203 | Machete 177
```

The eight commonest objects are all weapons. Type distribution of the table
itself is not the problem — `medical 13, utility 11, weapon 12, water 9,
food 9, tool 6, armour 4` is reasonable — the problem is that food spoils and
is eaten, so food items are never *held*, and the census reads as weapon-heavy
because weapons are the only durable category.

**The real finding is `armour: 4`.** Four armour objects in a game with an
`armour` fraction on `Item`, a `wearArmour` degradation path, an `armourOf`
sum, and a `fullKitSeen` achievement that had to be relaxed from four slots to
three because the carry capacity cannot support it. Four objects is not a
category.

**Fix.** Six to eight more armour/shield objects at different weight/coverage
tradeoffs (a buckler that costs a hand, a mail shirt that costs agility, a
helm that only protects the head site) would make `armourOf` a decision
instead of a rounding error — and `injurySeverity` is already per-site, so
site-specific armour is one field away.

## 6.5 Side systems that are working and should not be touched

- **The side market.** Live-priced propositions replacing a three-row fixed
  table; the victor book calibrates at 2.30x (victors priced 15.8% against a
  field mean of 6.9%) and 403 of 412 survivors moved off their opening line.
- **Abandoned camps.** 45.5% of runs contain one; discovered through the
  existing `zoneTraffic` machinery rather than a new system.
- **Legendary weapons.** 195 runs in 400 produce a named weapon, 239 named
  instances, surfaced in the tribute sheet with the blood count that earned it.
- **The night watch.** 94 watches posted per 400 runs, `Light Sleeper` finally
  has a job, and the `watch` role owns it.
- **Structural fatigue.** One shared mechanic replacing seven near-identical
  hand-authored collapse events, opt-in-free for any `ruins` zone.

---

# §7 — More ways to die, and more events

## 7.1 The death table, measured

At n=1,600 (28,979 deaths):

```
tribute         58.8%  (17,046)      infection        3.2%  (922)
arena/hazard    13.2%  (3,812)       frostbite        2.9%  (828)
poison           5.2%  (1,500)       dehydration      2.3%  (663)
bleeding         5.1%  (1,465)       starvation       0.6%  (175)
mutts            4.7%  (1,350)       border           0.5%  (148)
burns            3.7%  (1,070)
```

Every design guard on this table passes: tribute-caused deaths at 58.8%
against a goal of ≥40%, bleeding down to 5.1% against a ceiling of 13%,
mutts-and-hazards at 17.8% inside a 5–20% band. The shape is right.

3,546 distinct cause strings were observed across 400 runs, from 1,556
authored static strings plus templates. The vocabulary is enormous and that is
not the problem.

## 7.2 The universal death vocabulary is thin in exactly the place it claims not to be

Counted from the engine (excluding arena-specific data files):

```
climate.ts        12        combat.ts          1
survival.ts        9        verticality.ts     1
gamemaker.ts       7        exposure.ts        1
weatherFront.ts    4        infection.ts       1 (templated per site)
mutts.ts           2 (templated per mutt)      alliances.ts  1
```

Roughly 39 distinct universal causes, of which §1.10 shows three fire once or
twice per 400 Games. The non-combat half is the thin half, and its structure is
telling: **every universal death is a vital, a status, the weather, or a
mutt.** There is no universal death that comes from a *decision*, from
*another person's absence*, or from the *body's own history* other than
infection.

### Twenty universal deaths to add

Each is reachable in any arena, reads state the engine already keeps, and
needs one gate and one cause string.

**From the body's own history (reads `scars`, `woundAge`, `worstInfectionGrade`, `injurySeverity`):**

1. **"The scar gave first"** — a scarred site takes any new damage and reopens
   at the grade it scarred at. `scars` is written and read by exactly two
   things today. (Deliberately not "An old wound opened again", which already
   exists as a universal-pool event in `arenaFlavor.ts:14696` gated on the
   `Bloodied` trait — this one reads `scars`, which that one does not, and the
   two should not share a string.)
2. **"Favoured the wrong side"** — a tribute with `favouring` set loses a
   fight they would otherwise have won, on the guard side. `woundedSide` and
   `handedness` are both stored and neither is a fatal state.
3. **"Never got the arm back"** — a grade-3 arm that healed to a scar, plus a
   grapple, plus `wrestle` below a floor.
4. **"Could not carry themselves"** — `encumbranceOf` above a threshold with
   `fatigue` past the exhausted line, in transit. There is a full encumbrance
   model and it cannot kill anyone.
5. **"Starved with food in the pack"** — `vitals.hunger > 90` while holding a
   spoiled-only inventory. `spoilage` exists; nobody has ever died of
   mismanaging it.

**From a decision (the category with zero entries today):**

6. **"Drank it anyway"** — foul water with no purifier, deliberately, past
   `drinkThreshold + 20`. The mirror of `Ate what they knew better than to
   eat`, which is the only decision-death in the game.
7. **"Went back for it"** — died in a zone they had already fled, holding an
   objective of `reach` toward a cache they left. `abandonedCamps` records
   owner and contents.
8. **"Waited for someone who was already dead"** — held a `protect` objective
   on a ward whose cannon has fired, through the anthem. The anthem names the
   dead; ignoring it should cost.
9. **"Traded the wrong thing"** — died within two cycles of a parley in which
   they gave away armour, light or a purifier. `parley.ts` records the trade.
10. **"Took the shortcut"** — crossed a `collapsing` edge on its last
    crossing. `EdgeRule.crossings` is counted down and the exhaustion is
    currently silent.
11. **"Answered it"** — moved toward a `revealNoisyBreakdowns` or `revealFires`
    signal and met whoever made it. The reveal exists; walking toward it is
    not currently a distinguishable death.

**From another person's absence (reads the social layer):**

12. **"Nobody reached them"** — the downed window expires with a living ally within
    two zones who chose a different objective. `reachedDownedFirst` counts the
    successes; the failures are anonymous.
13. **"Slept alone"** — a tribute expelled from an alliance dies of a vital
    within three cycles of the expulsion. 205 charter expulsions per 400 runs
    produce no distinguishable outcome.
14. **"Owed too much"** — killed by a creditor whose `debts` entry was never
    settled. `repayDebts` runs every cycle; defaulting has a social cost and
    no terminal one.
15. **"Believed the wrong person"** — died in a zone they entered on a
    `hearsay` zone memory that was false. `ZoneMemory.hearsay` and `toldById`
    are both stored precisely so "a lie has an author to be furious with" —
    and the lie cannot currently kill.

**From the mind (the sanity model has one terminal state, the nightlock):**

16. **"Stopped hearing the cannons"** — `sanityScarred` plus a second descent
    to the floor. `sanityRecovered` marks coming back; going back down twice
    has no ending.
17. **"Followed the face"** — died in a zone entered during a hallucination.
    `SANITY_TEXTS.hallucination` is 40 lines of content with no consequence.
18. **"Gave the position away"** — `revealNoisyBreakdowns` fires and a hostile
    reaches them in the same cycle. Currently indistinguishable from an
    ordinary kill.

**From the arena as a class (reads terrain, not a named arena):**

19. **"Through the ice"** — `ice` terrain plus `massOf` above a threshold.
    There is a whole `ice` terrain and no ice-specific death outside authored
    arenas. (Distinct from `Went through the crust` and `Went through the
    pan`, which are a biome event and one arena's signature respectively.)
20. **"Lost the level"** — fell from `upper` to `lower` in a `vertical` zone
    while `quaking` is active. `quaking`'s type comment promises "the Ground
    Give beat" and the zone effect is one of the four rarest (§1.7).

## 7.3 Arena-specific deaths: the density is right, the procedural half is empty

```
arenaFlavor.ts           879 distinct causes
arenaFlavorNew.ts        187
proceduralBiomeEvents.ts 165
arenaEvents/group1-5     344
proceduralFlavor.ts       32
```

1,246 arena-authored causes for 45 arenas is 28 apiece — genuinely dense, and
`test:arenas` confirms all 45 can produce a death of their own.

The gap is the one §1.9 names: **the procedural path's own signature has one
obituary for twelve biomes.** `proceduralBiomeEvents.ts` carries 165 causes
across 12 biomes (13.75 each, against the authored roster's 28) and six of the
twelve biome packs sit at the hard floor of 8 events (§10.1).

### Arena-specific deaths to add, by target

**Procedural, via the `effectVocab` fix in §1.9** — 6 effect kinds × 12
biomes = 72 obituaries for one line of code. This is the single highest
ratio of content to effort anywhere in this report.

**The six floor-sitting biomes** (`tundra`, `dunes`, `bayou`, `ruinlands`,
`steppe`, `saltmarsh`) — eight events each against a target of 32. Twenty-four
more events apiece, of which at least eight each should carry a cause. Suggested
anchors, one per biome, each reading a mechanic the biome already has:

- **tundra** — "Went through the lead" (`ice` terrain + `massOf`); "Whited out"
  (fogbound + no `light`); "Slept warm and did not wake" (the `frozen` effect's
  own hypothermia).
- **dunes** — "Buried by the slipface"; "Drank the mirage" (a `waterSource`
  that derives false); "Walked the same dune three times" (`navigation` floor).
- **bayou** — "Taken under"; "Breathed the gas"; "Lost the boot and then the
  leg" (`wetland` + `infected`).
- **ruinlands** — "Under the last floor" (`structuralFatigue`, which already
  exists and is arena-agnostic); "Rebar through"; "Cut on what was left".
- **steppe** — "Nowhere to be"; "Ran out of grass"; "The wind took the fire and
  then the camp" (`tickCampConsequences`).
- **saltmarsh** — "Brined"; "The tide came in twice"; "Salt in the wound"
  (an infection accelerant the terrain justifies).

**The thirteen waterless arenas** (§1.6) — each needs a thirst-shaped death
that is *theirs*, because the universal
`Died of thirst within sight of the water` is structurally unreachable where
nothing is drinkable.

## 7.4 More events: universal

108 universal events against 1,542 arena-authored ones. Every universal event
carries a cause and **none of them is `once`-per-run** — the once-per-run
structure exists only in the arena packs. So the universal layer is 108
repeatable beats, and a long Games sees the same ones several times.

Twenty universal events to add, each reading existing state, each
arena-agnostic:

1. **The inventory audit** — a tribute counts what they have left and the
   chronicle says what they conclude. Reads `carryCapacity`, `encumbranceOf`.
2. **The first night alone** — the first cycle a tribute spends with no ally
   alive. Reads `formerAllies`, `sharedHistory`.
3. **The handedness beat** — a left-handed tribute using a right-handed
   weapon found on a body. `handedness` and `weaponFamiliarity` exist.
4. **Trading up** — dropping a worse weapon for a better one, with the
   `bloodDrawn` on the old one named.
5. **The quirk under pressure** — a quirk line fired at low `composure`
   instead of on a quiet cycle. 105 quirks × 4 lines, currently only surfaced
   when nothing is happening.
6. **Reading the sky wrong** — the anthem names somebody a tribute believed
   was dead already.
7. **The mentor's silence** — `mentorWithheld` is tracked and never narrated.
8. **The token, at the worst moment** — `token` is carried by 61.5% of
   tributes and surfaces at death and at victory only.
9. **Counting the cannons** — a tribute who has kept an accurate count meets
   one who has not.
10. **The weight of the pack** — a `capacity` item breaking.
11. **What the water tasted like** — a `purifies` item running out.
12. **The second-best plan** — `objectiveTension.runnerUp` narrated as a
    regret after the chosen objective fails. `voiced` exists; the failure case
    does not.
13. **Learning a name** — `notoriety` crossing a threshold for a stranger.
14. **The unearned reputation** — notoriety settling on the wrong person, which
    the system explicitly models and never says out loud.
15. **The shed trait** — `shedTraits` is stored for the epilogue and never
    narrated at the moment it happens.
16. **Growing into it** — `isGrowingInto` is a written predicate with, as far
    as the chronicle is concerned, no reader.
17. **The plate, remembered** — `platePosition` narrated late, by somebody who
    was standing next to them.
18. **Somebody else's watch** — the tribute who slept through the thing that
    killed the watcher.
19. **The trade that was not made** — a parley that ends with both walking
    away, narrated from both sides.
20. **The last of it** — the final consumable of a type being used, by anyone,
    anywhere.

## 7.5 More events: arena-specific

The authored roster does not need more events; it needs the ones it has to
fire more often (§5.3) and the packs to stop being seven long (§5.4). The
arena-specific event work belongs in three places:

1. **The six floor-sitting procedural biomes** — 192 events to go against the
   target, per `test:flavor`. This is the largest single content debt in the
   repository and it is already measured and reported by the check roster.
2. **The five thinnest per-run arenas** — `seapeaks` 0.8, `eclipse` 1.0,
   `labyrinth` 1.2, `saltworks` 1.5 distinct authored events per run. These
   are not thin packs (all 33+); they are packs with tight preconditions.
   Audit the gates, not the content.
3. **Chained events.** Every pack carries exactly one chain
   (`4 once, 1 chains` across all 45). A second chain per pack — a two-step
   consequence rather than a one-shot — would double the structural variety
   for a fraction of the writing.

---

# §8 — Trait and archetype balancing

## 8.1 The archetype win table, at n=1,600

```
spread (best/worst)   3.18x   guard <= 3.4   goal <= 2.3   SHORT
best   career     9.15% (n=1771)   guard <= 10.2   goal <= 8%   SHORT
worst  penitent   2.87% (n=835)    guard >= 2.6    goal >= 3.5  SHORT
```

Every one of the 35 archetypes cleared 500 entrants, so the verdict is sound.
The spread has come down from 4.35x (AUDIT-6) to 2.54x to 3.18x — **it went
back up**, and the cause is identifiable: the six archetypes AUDIT-7 added
occupy four of the bottom seven places.

```
bottom seven:
  broker        4.07%   (AUDIT-6 addition)
  understudy    3.77%   (AUDIT-7)
  archivist     2.95%   (AUDIT-7)
  penitent      2.87%   (AUDIT-6)
  herald        4.09%   (AUDIT-6)
  debtor        4.10%   (AUDIT-7)
  confessor     4.14%
```

The three most recent batches (AUDIT-6's six, AUDIT-7's six) supply nine of
the twelve lowest win rates. This is a systematic effect, not twelve
coincidences: **a newly added archetype is defined by the
stance/objective/target combination nothing else holds, and the combinations
nothing else holds are the ones that were left over because they are weak.**

The rule "each has to hold a combination nothing in the table holds" has been
applied for four consecutive batches and has produced, each time, a cohort at
the bottom of the table. It is a good rule for *distinctiveness* and a bad one
for *balance*, and nothing in the process currently trades them off.

**Fix.** Keep the distinctiveness rule and add a second: every new archetype
must ship with a measured win rate inside ±1.5 points of the field mean at
n≥1,600 before it merges. That is one metrics run per batch. The four bottom
archetypes each need one concrete advantage rather than a rebalance:

- **`penitent` (2.87%)** — 4.80 avg days, 0.38 avg kills. It survives and
  cannot close, which is exactly the Saboteur's old diagnosis (AUDIT-6 fixed
  that one by giving it a `late-blooming` payoff that actually paid). Give the
  vow a mechanical discharge: a Penitent who reaches the final four with their
  vow intact should get something.
- **`archivist` (2.95%)** — 0.36 kills, the lowest in the table. Its signature
  fires at 57.3%, so the beat lands and does nothing. What it learns should
  transfer: an Archivist's `read` on a rival should be near-1 by the endgame.
- **`understudy` (3.77%)** — mean peak `unseenStreak` 0.89, second-lowest in
  the field. It is a shadow archetype that is constantly seen.
- **`broker` (4.07%)** — §1.2. A quarter of its trait identity is a typo.
  Fix that before touching anything else and re-measure.

## 8.2 Signature fire rates, and the floor

```
forecaster 60.9% ... captor 29.1% ... quiet 4.5%   (floor 29%)
```

Excluding `quiet` (§1.1), the spread is 60.9/29.1 = 2.1x, which is
respectable. But the bottom six are all recent:

```
captor 29.1 | bellwether 32.8 | cartographer 33.4 | broker 33.9
warden 34.8 | duellist 36.8
```

and five of the six are from the last three batches. Same effect as §8.1, same
cause: late-added signatures gate on late-added state, and late-added state is
rare (§3.5, §5.2).

## 8.3 The reaping-trait table is 4.44x apart against a goal of 2.5x

```
spread (best/worst)   4.44x   guard <= 4.5   goal <= 2.5   SHORT
best   Brute   9.36% (n=1346)
worst  Devout  2.11% (n=522)
bottom six: Good For It 3.08, Merciful 3.01, Night Ear 2.92,
            Straight Story 2.86, Field Surgeon 2.78, Devout 2.11
```

It is sitting 0.06 under its own regression guard, which means one more
content change moves it into failure. The guard has been at 4.5 for three
audits and the measured value has crept 4.31 → 4.44.

The header comment on this table is correct and important — *"A trait far off
the field mean with a large n is as likely to be measuring who receives it as
what it does"* — and `Brute` at n=1,346 is receiving-biased (Careers). But the
bottom six are not: `Devout` (n=522), `Field Surgeon` (n=324) and
`Straight Story` (n=350) are ordinary-sample traits winning at a third to a
half of the field rate.

Looking at their rows:

- **`Devout`** carries `resolveDrift` and `sanityDrain` — the two modifiers
  most directly opposed by the arena's own pressure curve — and nothing
  offensive at all. It is the purest "modifier that helps you last" trait in a
  table where lasting is 41% of the win condition and killing is 59%.
- **`Field Surgeon`** carries `medicine`, which 39.3% of tributes never train
  (§3.5), so its bonus is applied to a skill most of the field is at zero on.
- **`Straight Story`** carries social modifiers gated on parleys, which fire
  452 times per 400 Games across a field of ~19.

The pattern across all six: **a trait whose modifiers feed a subsystem with a
low fire rate wins less, regardless of how large its numbers are.** That is
§3.5's finding read from the other end, and it means the trait table cannot be
balanced independently of the proficiency and parley reach problems.

## 8.4 Trait power level by category

```
combat    n=48  mean 0.80  sd 0.74   hot: Hardened 3.45, Unremarkable 2.92
social    n=34  mean 0.93  sd 0.60   hot: Dead-Eyed 2.55, Quiet Room 2.50
survival  n=52  mean 0.79  sd 0.58   hot: Waterborn 2.54, Slow Burn 2.30
```

Means are within 0.14 of each other across three categories, which is tight.
The outliers are almost all *earned* traits (`Hardened`, `Waterborn`,
`Broken`), which is correct — an earned trait should be stronger than a rolled
one. `Unremarkable` at 2.92 sd in the combat category is the odd one: it is
rollable, it is a large negative-space trait, and it wins at 5.95% (field
mean 5.5%).

## 8.5 District legacy is a real, stable, intended handicap

```
strong     9.0%  (287 of 3,200 entrants)
storied    8.3%  (534 of 6,400)
modest     4.1%  (165 of 4,030)
forgotten  3.9%  (257 of 6,530)
thin       3.4%  (356 of 10,460)
```

2.6:1 top to bottom, monotone, with every tier over 3,000 entrants. This is
the underdog engine working as designed.

**A caution for whoever reads the by-district table next.** `metrics.ts`
prints districts 13–16 at 0.1% each (1 victor apiece of 1,600). That is a
*share of all victors*, and districts 13–16 only exist in 16-district configs,
of which the metrics sweep runs none — the four configs are 6, 8, 12 and the
default. AUDIT-6 §8.5 read this table as win rates and concluded those
districts were unwinnable; they are not, and this audit is not repeating that.
Per entrant they sit in the same band as districts 5 and 6.

## 8.6 The trait/quirk modifier distribution is healthy

59 `TraitMod` keys, all carried, none at zero. Usage counts across traits and
quirks:

```
heaviest: allianceAffinity 35, resolveDrift 30, retreat 30, concealment 27
          awareness 24, treachery 17, excitement 17, griefResist 16
lightest: rumourCredibility 2, executeDrive 3, hornCommitment 3,
          intimidation 3, leadership 3, charterHold 3, suspicionResist 3,
          debtHonour 3, haggle 3
```

The nine keys carried by three or fewer rows are all social/parley keys added
by AUDIT-6 §12.2 and AUDIT-7. They exist and are under-represented in the
trait pool, which is a content gap rather than a bug — and §12 proposes
filling it.

---

# §9 — Replayability, and not going stale

## 9.1 The variance problem is solved and stays solved

```
average run length     11.05 days   (guard 10-13, goal 10.5-12)  MET
run length spread      3.08 sd      (guard >= 1.4, goal >= 2.0)  MET
runs ending with no victor  0.1%    (guard <= 5%, goal <= 2%)    MET
Quells                 25.3% of runs, 26 of 28 drawn in 400 runs
temperaments           9, evenly drawn (34-54 each per 400 runs)
wildcard calendar      40 distinct entries, 4,000 calendars swept, 0 repeats
```

A player who runs ten Games sees two or three Quells, nine temperaments'
worth of pacing, and a different calendar every time. This is the strongest
part of the product and three consecutive audits have said so.

## 9.2 Off-season skins are 17.3% of runs and half of them are never seen

```
offSeason: 71/400 runs skinned (17.8%), 49/135 distinct skins seen
reach probe: 17.3% of runs, 56 of 135 distinct skins
```

135 authored cosmetic skins, of which a 400-run sweep shows 49–56. At the
measured rate a player sees a skin one run in six, and would need roughly
1,000 Games to see them all.

AUDIT-6 added skins for the five newest arenas specifically so every arena had
one; the coverage is 45/45. The *draw rate* was never raised to match.

**Fix.** Raise the skin chance to ~35% and weight the draw against
`PanemRecords` — the storage layer already records what has been seen
(`deathsSeen`, `eventsSeen`, `quellsSeen` all exist). A skin the player has
not seen should be likelier than one they have. That single change turns a
cosmetic layer into a collection, which is a replay driver.

## 9.3 The collection layer exists and does not close any loops

`PanemRecords` tracks `runs`, `victors`, `unlocked`, `unlockedAt`, `bests`,
`gamemakerRecords`, `districtCrowns`, `quellsSeen`, `deathsSeen`,
`eventsSeen`, `dailyBests`, `recentRuns`. That is an unusually complete
career ledger.

What it does not have is a **reason to come back tomorrow specifically**.
`dailyBests` (added since AUDIT-7 §9.3, which asked for exactly this) records
the best result on today's seed — but there is no streak, no "you have played
4 of the last 7 dailies", and no comparison to anything but yourself.

**Fix.** Three fields: `dailyStreak`, `dailyLastPlayed`, `dailyPlayed: string[]`.
The daily already derives deterministically from the UTC date; a streak is
arithmetic on dates the store already writes.

## 9.4 Twenty-six achievements never unlock, and fifteen of them are AUDIT-7's

```
never unlocked (26): all labelled 'possible'
  no-victor, every-door, grey-market, the-quiet-one, the-unwitnessed,
  rooted, careers-early, every-persona, twelve-levers, expelled-and-won,
  walked-it-all, the-mentor-was-right,
  a7-held-the-crossing, a7-whole-vocabulary, a7-scored-one, a7-scored-twelve,
  a7-believed-three-lies, a7-no-cannon-till-four, a7-beat-the-fever,
  a7-four-scars, a7-came-back-from-the-floor, a7-unsponsored,
  a7-mercy-on-the-victor, a7-revealed-and-survived, a7-stripped-the-crown,
  a7-allies-to-the-last-two
```

**Fifteen of twenty-six carry the `a7-` prefix.** AUDIT-7 §11.4 added seventy
achievements; 15 of them (21%) have never fired in 500 measured runs and
2 more are near-automatic (`a7-decided-in-the-convergence` 72.8%,
`a7-set-piece-and-out` 65.0%, `a7-token-to-the-end` 60.6%). So roughly a
quarter of the most recent batch is mis-calibrated in one direction or the
other.

The `possible` tier is well-designed — "a standing invitation with a test
attached" — and four labels are currently contradicted by measurement at 0.2%
(one observation in 500), which the checker reports and correctly does not
fail on.

But fifteen unreachable entries in one batch is not a tier, it is a
calibration failure, and the cause is visible in the list: several of them
gate on exactly the systems §3.5, §5.2 and §6.3 show are under-reaching.
`a7-held-the-crossing` needs a garrisoned edge (19.3% of runs);
`a7-believed-three-lies` needs three false hearsay memories at once against
263 lies per 400 runs; `a7-four-scars` needs four grade-2+ scars on one
tribute when 3.6% of tributes have any scar at all.

**Fix.** Before adding more (§11), re-gate these fifteen against measured
reality — most need one threshold lowered by one. `ACHIEVEMENT_EMIT_RARITY=1`
regenerates labels from data; there is no equivalent for regenerating
*thresholds*, and there should be a report that names, for every
numeric-threshold achievement, the maximum value actually observed.

## 9.5 The procedural generator is broader than its content

```
12 biomes | 648 signature-rule combinations | 16 zone names per biome
per-arena mutt rosters | per-biome effect vocabularies | terrain variants
```

against

```
procedural: 0.4 distinct authored events fired per run (§5.3)
6 of 12 biome packs at the hard floor of 8 events, target 32 (§10.1)
4 of 10 zone-effect kinds unreachable (§1.7)
2 of 36 payload/selector pairs inert (§1.8)
1 obituary for the whole path (§1.9)
```

The machinery is excellent and the content behind it is the thinnest in the
repository. A player who picks "surprise me" gets a structurally varied map
with almost nothing authored to say about itself. Fixing §1.7, §1.8 and §1.9
— maybe forty lines between them — plus the 192 missing biome events is the
highest-leverage replayability work available.

## 9.6 Two more structural ideas, neither requiring a new mechanic

- **The dynasty.** `victorIds`, `mentorIsVictor`, `veteranOf` and the Hall of
  Fame all exist, and `veteranOf` was set on **zero tributes across 400 runs**
  because a Grudge Match is the only writer and it is hand-invoked. A
  district whose previous victor mentors this year's tributes is already
  modelled (`mentorIsVictor` feeds `mentorGenerosity` and `MENTOR_PULL`);
  surfacing it as a *career arc* across runs — "District 7 has crowned three
  in five years" — is a presentation change over data already stored.
- **The seen-it-before weighting.** `deathsSeen` and `eventsSeen` are unioned
  into `PanemRecords` every run and read by the record book only. Weighting
  the arena event draw, the mutt draw and the skin draw against them would
  make run 20 systematically different from run 19 without adding a single
  piece of content.

---

# §10 — Shallow or incomplete features; names and flavour

## 10.1 "Authored exactly to the floor", in eight places at once

This is the same pattern AUDIT-7 §10.1 named, and it has survived the fix.

| Pool | Floor / target | Measured |
|---|---|---|
| Arena set-piece packs | — | **all 45 at exactly 7** |
| Arena event packs | floor 33, target 40 | **30 of 45 sitting exactly on 33**; 40 under target; 260 events to go |
| Interview scenarios | target 15 | **all 18 personas at exactly 15/15** |
| Quirk line variants | floor 4 | **all 105 at exactly 4** |
| Procedural biome packs | floor 8, target 32 | **6 of 12 at exactly 8**; 192 events to go |
| Conditional-stance pools | floor 8 | 40 arenas author them; **generic carries exactly 12** |
| Nested flavour pools | floor 8 | thinnest at exactly 8 |
| Flavour pools | target 12 | smallest at exactly 12 |

Eight pools, every one of which sits on its own number. AUDIT-7's response was
to split the floor from the target so the floor fails the build and the target
is reported as distance-to-go. That was the right structural fix and the
authoring behaviour did not change: the floor moved from 24 to 33 and 30 packs
moved to exactly 33.

**This is a process finding, not a content one.** A number that everything
sits exactly on is a number that is being satisfied rather than a standard
that is being met. The mechanism that would change it is to make the *target*
the failing line and give it a schedule — e.g. the target rises by one every
quarter — so "exactly at the floor" stops being a stable state.

## 10.2 Persona and angle use is 5.2:1 and 4.6:1

```
persona (7,640 tributes):
  Mysterious Enigma 839 | Quirky Oddball 721 | Humble Underdog 718
  Professional 603 | Ruthless Warrior 598 | Arrogant Brute 534
  Charming Flirt 447 | Provocateur 435 | Silent Threat 420 | Survivor 358
  Cold Strategist 350 | Star-Crossed Lover 331 | Homesick 293
  Volunteer 288 | District Loyalist 194 | Wildcard 182
  Grieving Sibling 169 | Reluctant Hero 160

angle:
  alliance-signal 1450 | grief 730 | target-callout 634
  defiance 327 | showmance 318
```

5.2:1 across personas (AUDIT-7 §10.2 measured 5.4:1 — essentially unmoved) and
4.6:1 across angles. Every persona carries exactly 15 success and 15 failure
scenarios (§10.1), so **the four rarest personas have 30 authored lines each
that a player sees once in forty tributes.**

The bottom four (`District Loyalist`, `Wildcard`, `Grieving Sibling`,
`Reluctant Hero`) are all *conditional* — they are picked when a tribute's
circumstances fit — and the conditions are narrow. `Grieving Sibling` needs a
bereavement in the backstory; `Reluctant Hero` needs a specific
volunteer/motive combination.

**Fix.** Either widen the conditions or make the persona a *choice* the
tribute's charisma and archetype bias rather than a lookup. The
`playerCoaching` field already lets the player set `interviewStrategy`
directly for one tribute, which proves the plumbing.

## 10.3 Log-category balance: three categories are under 1%

Across 400 runs, 495,000 log lines:

```
training  13.0%    sponsor   3.2%    feast     1.3%
sanity    11.7%    arena     2.9%    death     1.2%
travel    11.6%    loot      2.1%    mutt      1.1%
survival  10.0%    injury    1.7%    kill      0.9%
alliance   9.5%    hazard    1.6%    betrayal  0.6%
system     9.3%    gamemaker 1.4%    romance   0.5%
interview  9.0%
combat     7.4%
```

AUDIT-7 §10.4 reported two categories under 1%; there are now three, and the
three are `kill`, `betrayal` and `romance` — which is to say, the three most
*dramatic* categories in the taxonomy are the three thinnest lines in the
feed.

Meanwhile `training` (13.0%) and `interview` (9.0%) together are **22% of
every chronicle**, spent before anybody is in the arena. A reader scrolling a
finished run spends more than a fifth of it on the pre-Games.

This is not an argument for cutting the pre-Games, which is good. It is an
argument that the arena's dramatic beats are under-narrated relative to its
procedural ones: `travel` at 11.6% is nearly thirteen times `kill`.

**Fix.** Kills, betrayals and romances should each produce a *scene* —
two or three lines with aftermath — rather than one line, and the aftermath
pools already exist (`BETRAYAL_AFTERMATH_TEXTS` is 32 lines against 3.5 draws
per run, a 9.1x depth ratio, i.e. massively under-drawn).

## 10.4 Flavour pool depth against measured draws

```
GRIEF_TEXTS                 55 lines / 13.4 draws  (4.1x)
INTIMIDATION_TEXTS          18 / 4.1   (4.4x)
SANITY_TEXTS.dropItem       20 / 4.5   (4.4x)
SANITY_TEXTS.hallucination  40 / 8.0   (5.0x)
SANITY_TEXTS.ruinStealth    60 / 11.7  (5.1x)
SPONSOR_TEXTS               90 / 16.1  (5.6x)
VENGEANCE_TEXTS             72 / 12.3  (5.9x)
BETRAYAL_AFTERMATH_TEXTS    32 / 3.5   (9.1x)
RELIEF_TEXTS                18 / 1.3   (13.8x)
AMBIENT_TEXTS               24 / 1.6   (15.0x)
```

Everything is above 4x, which is a healthy floor — a player will very rarely
see the same line twice in a run. The interesting reading is the other end:
`BETRAYAL_AFTERMATH_TEXTS`, `RELIEF_TEXTS` and `AMBIENT_TEXTS` are at 9–15x,
meaning content exists that is drawn once or twice a Games. Those three are
candidates for being drawn *more* rather than written *more*, which is §10.3's
fix from the supply side.

## 10.5 Names: the pools are deep, the constraint is respected, and the shape is fine

```
3,944 names across 16 districts, 267 in more than one pool, none in more than 2
initial-letter spread 4.2:1 (S 356 to U 85), max allowed 30:1
204 mentors, every pool >= 12, none shared
no themed name has wandered out of its district
no name contains a space, apostrophe or hyphen — one token, always
```

The no-surnames rule is enforced by regex in `check-names.ts` on both the
gendered and neutral pools, and the `NEUTRAL_NAMES` pool (384 entries, 24 per
district) exists specifically to flatten the initial-letter distribution and
is itself constrained to scarce initials.

Two mild asymmetries, neither a fault:

- Pools run 107–115 per gender against a target of 100; districts 1–4 are at
  115 and districts 10–16 at 107–108. The Career districts are marginally
  better stocked than the outer ones.
- Name length peaks at 6 characters (915 of 3,293 unique) with a thin tail:
  58 three-letter names and 18 at eleven-plus. Short, punchy names —
  `Chaff`, `Rue`, `Gale` — are the canon register and are under-represented.

## 10.6 Mechanics that are shallow and should be deepened rather than widened

Each of these has a complete data model and a fire rate that makes it
invisible. They are listed here rather than in §6 because the fix is depth,
not another feature.

1. **Performed bonds** — 220 tribute-cycles per 400 runs (§4.4).
2. **The coup** — 15 per 400 runs against 369 walkouts (§4.2).
3. **The hearing** — 9 per 400 runs against 205 expulsions (§4.2).
4. **The lie** — 263 against 1,143 honest shares (§6.2).
5. **Camouflage** — 164 against 1,335 shelters (§6.1).
6. **The standoff** — 76 per 400 runs (§6.3).
7. **The parasite mutt** — 20 authored, 1 kill per 400 runs (§1.10).
8. **The vertical zone** — 176 authored vertical zones, 38% of tributes ever
   change level, and `verticalZonesStood` (the multi-zone version) drives two
   achievements that never fire.
9. **Armour** — four objects (§6.4).
10. **`Arena.mutts` and `Arena.events`** — two `string[]` fields on the arena
    type, documented as flavour-only, read by nothing. Delete them.

---

# §11 — More achievements, more names

## 11.1 The roster, measured

```
336 entries + 22 meta, over 500 completed runs

by category: social 59 | arena 53 | survival 46 | capitol 40
             games 38 | oddity 36 | reaping 35 | combat 29
by rarity:   rare 152 | common 85 | legendary 69 | possible 30

never unlocked           26   (all 'possible'; 15 are a7-)
near-automatic (>=60%)   10
in the usable 5-60% band 200 of 336 (59.5%)
numeric-threshold tests  156, all 156 carrying a nearMiss
```

200 of 336 in the usable band is a good number. The two tails are the work:
26 that never fire (§9.4) and 10 that fire in three runs of five.

The near-automatic ten:

```
made-them-blink 90.8% | outlived-the-map 77.6% | kept-word 74.6%
a7-decided-in-the-convergence 72.8% | the-unnamed 66.0%
someone-elses-war 65.6% | a7-set-piece-and-out 65.0% | apothecary 60.8%
the-token 60.6% | a7-token-to-the-end 60.6%
```

`the-token` at 60.6% and `a7-token-to-the-end` at 60.6% are the same
achievement twice — not "essentially" the same, but byte-identical predicates
(§1.4). So the near-automatic list is really nine entries, one of which is
double-counted.

## 11.2 The roster is 318 achievements, not 336

§1.4 proves it: 16 groups of identical predicates covering 34 entries. Every
category count in this report, in `ACHIEVEMENT_CATEGORIES` and in the record
book's progress bars is inflated by 10%. After merging:

```
                 shown   real
social             59     54
arena              53     51
survival           46     44
capitol            40     35
games              38     38
oddity             36     33
reaping            35     31
combat             29     27
                  ---    ---
                  336    318
```

Two consequences for this section.

1. **Merging is worth more than adding.** A player who sees three cards flip
   at once for one boolean learns that the achievement list is padded, and
   that is a worse outcome than a shorter list.
2. **`combat` is the thinnest shelf before and after the merge** (29 shown,
   27 real, against `social` at 54). The additions below are weighted
   accordingly.

## 11.3 Sixty achievements to add

Chosen against three rules the existing table keeps: every entry reads state
the engine already stores; no entry gates on a subsystem measured under 20%
reach; and the category balance moves toward `combat` (29, the thinnest).

**Combat (12)** — the thinnest shelf.

1. **First and Last** — your victor landed the first killing blow of the Games
   and the last. (`firstBloodId`, `finalTwoCycle`)
2. **Never Swung Twice** — every kill your victor took was a single exchange.
3. **The Long Reach** — win with a ranged weapon having never been in the same
   zone as anyone you killed. (`weaponClass`, `zoneDeaths`)
4. **Bare Hands** — take a kill with `everCarriedWeapon` false.
5. **Two Grades Down** — win a fight while carrying a grade-3 injury.
   (`injurySeverity`)
6. **Off Hand** — take a kill with `woundedSide === handedness`.
7. **The Whetstone** — win holding a weapon at full durability that has
   `bloodDrawn >= 3`.
8. **Broke Off Four Times** — a victor with `RivalRecord.timesFled >= 4`
   against one opponent they eventually killed.
9. **Never Rattled** — win with `rattled` never above zero.
10. **Momentum** — three kills inside four cycles. (`momentum`)
11. **The Second Exchange** — kill someone who had previously beaten you.
    (`RivalRecord.woundsTaken > 0`)
12. **Cold Steel** — win having never used a weapon you did not find at the
    horn.

**Social (8)** — reading the layers §4 shows are healthy.

13. **Eight Ledgers** — hold debts from eight different tributes at once.
14. **Both Sides** — broker a truce between two people who had both betrayed
    you. (`brokeredTruces`, `memory.betrayedBy`)
15. **The Quartermaster's Word** — hold the `keeper` role and end with every
    debt settled.
16. **Four Reasons** — hold truces of all four `TruceReason` kinds in one run.
17. **Inherited Twice** — succeed as heir in two different alliances.
    (`succeededAsHeir`, `roleCycles`)
18. **The Whole Charter** — belong to an alliance whose charter carried five
    clauses and broke none. (`deepestCharter`, `breaches`)
19. **Reconciled** — a victor who ended a feud that had reached three fights.
20. **Never Sworn To** — win with nobody having ever sworn vengeance on you.

**Survival (8)**

21. **Off the Floor Twice** — `lowHealthRecoveries >= 2`.
22. **Every Site** — take and heal an injury at all four body sites.
23. **The Long Fast** — six consecutive cycles past `starvingThreshold`,
    and live. (`conditionPressure`)
24. **Walked It Off** — end a run with `sleepDebt` at zero having never slept
    in an alliance.
25. **Two Fevers** — beat terminal infection twice.
    (`worstInfectionGrade`, `septicCycles`)
26. **Frame Intact** — win with `condition` unchanged from the reaping.
27. **Drank Nothing Found** — win having only ever drunk purified or carried
    water.
28. **The Whole Ladder** — pass through four distinct `Condition` rungs in one
    run.

**Arena (8)**

29. **Every Terrain** — stand on all terrains the arena contains.
    (`visitedZones` + zone lookup)
30. **Knows the Back Ways** — know three hidden edges. (`knownEdges`. Not
    "Cartographer" — that id is taken, twice, and is one of §1.4's
    duplicate pairs.)
31. **Held the Pass** — garrison the same edge for five consecutive cycles.
32. **Both Levels, Three Zones** — `verticalZonesStood.length >= 3` (the
    existing entry asks for more than the map supplies — this is its
    re-gated replacement).
33. **Out of the Bloom** — be in a `blooming` zone the cycle it starts.
34. **Eight Effects** — witness eight of the ten `ZoneEffectKind`s in one run.
35. **The Tide Twice** — survive two `tidalBorders` re-cuts. (arena-gated via
    `availableIn`)
36. **Last Zone Standing** — win in the zone you started in. (`visitedZones[0]`)

**Capitol (7)**

37. **Never Asked** — win with `sponsorTrust` never above its opening value.
38. **The Whole Bloc** — receive a gift from every sponsor bloc.
    (`sponsorBlocBudgets`)
39. **Backlash and Back** — accrue `personaBacklash` above a threshold and end
    with `personaCredit` higher.
40. **Twelve and Twelve** — a training score of 12 and a victory.
    (currently `a7-scored-twelve` never fires — this is its re-gate at "12 in
    the private session", which `privateSession.score` stores)
41. **The Gamemaker's Name** — survive the Head Gamemaker's signature.
    (`gamemakerSignatureFired`)
42. **Bought Nothing** — a Games in which the player spent no Capitol Coins
    and crowned a victor.
43. **The Bell Four Times** — be paid by `theBell` on four separate mornings.

**Reaping (6)**

44. **Six Tesserae** — win carrying `tesserae >= 6`.
45. **The Far Plate** — win from `platePosition > 0.9`.
46. **Both From One** — the final two are the same district's pair.
47. **Twelve Years Old** — win at the minimum age.
48. **Volunteered For Nobody** — `volunteered` true with no district partner
    alive at the reaping.
49. **The Whole Bowl** — a Games in which every district's pair included at
    least one volunteer.

**Games (5)**

50. **No Alliance Ever** — a Games in which `state.alliances` never held an
    entry.
51. **Everyone Knew Everyone** — every surviving pair at the final six has
    non-zero `notoriety` for the others.
52. **The Quiet Year** — a Games with fewer than three `kill`-category lines.
53. **Twenty Days** — a Games that ran twenty days.
54. **Two Feasts, Two Themes** — `feastsHeld >= 2` with distinct themes.

**Oddity (6)**

55. **Named for Something They Did Not Do** — a victor whose `epithet` was
    awarded on notoriety accrued without contact.
56. **The Weapon Outlived Them** — a named weapon that passed through three
    owners. (`legendName` + `bloodDrawn` continuity)
57. **Nobody Lied** — a Games with zero planted rumours.
58. **Every Persona Once** — across a career, not a run. (Meta; the existing
    `every-persona` is a per-run entry that cannot fire.)
59. **The Same Zone Twice** — two separate deaths in the same zone on the same
    cycle.
60. **Shed Everything** — a victor whose `shedTraits.length` equals
    `startingTraitCount`.

Plus **two meta achievements** on the career ledger, which is the layer with
the most stored state and the fewest readers: **The Archive** (see 300 distinct
`deathsSeen`) and **The Grand Tour** (win in all 45 hand-authored arenas).

## 11.4 Two hundred names to add — no surnames

The rule is unchanged and enforced: **one token, no spaces, no apostrophes, no
hyphens, and there is no surname pool.** Every suggestion below is a single
token.

Targets, from §10.5: the pools are at 107–115 against a target of 100, so the
addition should go to the districts at 107 (10–16) and to the two shapes the
distribution is short of — **short names (3–4 characters)** and **the scarce
initials** `J U E N I` that `NEUTRAL_NAMES` has not fully absorbed.

**District 10 — livestock, hide, pasture (28: 14M/14F)**
Male: `Jeb`, `Hock`, `Nub`, `Ell`, `Urn`, `Yoke`, `Ing`, `Tup`, `Kern`, `Bran`,
`Jess`, `Elk`, `Neat`, `Isle`
Female: `Nan`, `Ewe`, `Jill`, `Udder` → `Udra`, `Ivy`, `Elm`, `Nell`, `Jenn`,
`Urda`, `Ysa`, `Kine`, `Ren`, `Ede`, `Isla`

**District 11 — orchard, grain, harvest (28)**
Male: `Jute`, `Ear`, `Nut`, `Ish`, `Urd`, `Yam`, `Ken`, `Bole`, `Jem`, `Emm`,
`Nard`, `Ilex`, `Ulm`, `Yarr`
Female: `Juna`, `Ela`, `Nim`, `Isa`, `Urse`, `Yara`, `Kel`, `Bay`, `Jess`,
`Emmer`, `Nix`, `Ivory` → `Ivor`, `Umbra`, `Yew`

**District 12 — seam and merchant (28)**
Male: `Jed`, `Ember`, `Nix`, `Ink`, `Urn`, `Yarrow` → `Yarr`, `Kell`, `Brack`,
`Jorn`, `Esk`, `Nyle`, `Idris`, `Ulf`, `Yance`
Female: `Jess`, `Eda`, `Nyl`, `Isla`, `Ursel`, `Yara`, `Kess`, `Bree`, `Jun`,
`Elka`, `Nettle` → `Nettl`, `Iva`, `Umber`, `Yew`

**Districts 13–16 — the expanded territories (116 total, 29 apiece)**

These four are the newest pools and the ones at exactly 107. Their themes are
already established in the file; the additions should follow them. Per
district, 15 male and 14 female, weighted heavily toward 3–5 characters and
the scarce initials.

- **13 (graphite, munitions, the underground):** `Jolt`, `Nim`, `Ith`, `Urq`,
  `Ean`, `Kade`, `Bole`, `Jarn`, `Emm`, `Nell`, `Isk`, `Ulv`, `Yann`, `Kir`,
  `Bren` / `Juna`, `Nixa`, `Ione`, `Urla`, `Eda`, `Kael`, `Bria`, `Jenn`,
  `Elsa`, `Nyx`, `Isa`, `Ulla`, `Yara`, `Kess`
- **14 (glass and kiln):** `Jar`, `Nim`, `Isin`, `Urn`, `Elu`, `Kiln` → `Kilne`,
  `Blow`, `Jax`, `Emb`, `Nard`, `Ige`, `Ulm`, `Yett`, `Kane`, `Brit` /
  `Jula`, `Nia`, `Isla`, `Ursa`, `Ember`, `Kila`, `Bria`, `Jess`, `Elra`,
  `Nyla`, `Ilse`, `Ula`, `Yenn`, `Kess`
- **15 (deep water and salvage):** `Jetsam` → `Jets`, `Nett`, `Iron` → `Iro`,
  `Urk`, `Ebb`, `Keel`, `Brine` → `Brin`, `Jol`, `Emm`, `Nor`, `Isl`, `Ulv`,
  `Yaw`, `Kelp` → `Kelpe`, `Brak` / `June`, `Nixie` → `Nixa`, `Isla`,
  `Undine` → `Undi`, `Ebba`, `Kai`, `Bria`, `Jenn`, `Elva`, `Nerissa` → `Neri`,
  `Ione`, `Ula`, `Yara`, `Kess`
- **16 (the last territory — wind, wire, frontier):** `Jib`, `Nock`, `Iron`,
  `Urs`, `Eol`, `Kest`, `Brant`, `Jorr`, `Emm`, `Nyle`, `Isk`, `Ulf`, `Yann`,
  `Kade`, `Bryn` / `Jara`, `Nell`, `Isa`, `Ursa`, `Eira`, `Kira`, `Brea`,
  `Jenn`, `Elin`, `Nix`, `Ilva`, `Ula`, `Yenn`, `Kess`

That is roughly 200 across seven districts. Every one is a single token, every
one is under nine characters, roughly a third are three or four characters,
and the initials are weighted to `J U E N I K B Y`.

**Two constraints to check on merge**, both already enforced by
`check-names.ts` and both easy to trip with a list this size: no name may
appear in more than two district pools (several of the above — `Jess`, `Emm`,
`Kess`, `Yara`, `Isla`, `Nix` — are deliberately repeated and must be pruned to
at most two homes each), and no name may sit in both the Male and Female pool
of the same district.

**Also worth adding: 100 more mentors.** 204 mentors across 16 districts is
12–13 apiece. The mentor is the most-repeated proper noun a returning player
encounters, and the check's own header says so. Six more per district takes it
to 300 and roughly halves the repeat rate.

---

# §12 — More traits, skills, archetypes and stances

## 12.1 The current shape

```
149 traits (124 rollable, 25 earned), 59 TraitMod keys, all carried
105 quirks, all with mods, 4 line variants each
35 archetypes, 35 distinct signatures
12 stances (3 unconditional, 9 conditional)
19 proficiencies
18 interview personas
```

## 12.2 Fix what is declared before adding more

Five items, all established above, all of which make existing content work
before any new content is written. **None of the additions below should land
before these.**

1. **§1.2** — the Broker's phantom trait, and the reference check that would
   have caught it.
2. **§1.1** — the `quiet` signature, and the sample size that hides it.
3. **§1.4** — the 34 duplicate achievements, before §11.3's sixty land on top
   of them.
4. **§1.11 / §3.5** — seven proficiencies with population means under 0.4,
   three of them under 0.13, one of them structurally untrainable. Adding a
   twentieth skill while `signalling` sits at 0.01 repeats the mistake at a
   larger scale.
5. **§4.6** — fourteen archetypes hated by nobody and three that hate nobody.
   Adding archetypes 36–41 without fixing this makes it seventeen and six.

## 12.3 Thirty new traits

Weighted deliberately toward the nine `TraitMod` keys carried by three or
fewer rows (§8.6) — `rumourCredibility` (2), `executeDrive`, `hornCommitment`,
`intimidation`, `leadership`, `charterHold`, `suspicionResist`, `debtHonour`,
`haggle` (3 each) — because a modifier carried by two traits is a modifier the
player will essentially never see.

**Carrying the thin social keys (12):**

| Trait | Mods |
|---|---|
| **Straight Dealer** | `debtHonour +0.15`, `haggle +0.1`, `treachery -0.1` |
| **Known Liar** | `rumourCredibility -0.4`, `haggle +0.15`, `suspicionResist -0.1` |
| **Takes The Floor** | `leadership +0.2`, `oratory` floor, `excitement +0.1` |
| **Clause-Minded** | `charterHold +0.2`, `debtHonour +0.1`, `allianceAffinity +0.1` |
| **Slow To Doubt** | `suspicionResist +0.25`, `betrayalResist -0.1` |
| **Trusted Voice** | `rumourCredibility +0.3`, `persuasion +0.05` |
| **Hard Look** | `intimidation +0.2`, `targetDraw +0.5`, `rapport -0.1` |
| **Settles Up** | `debtHonour +0.2`, `capacity +1` |
| **Pack Sense** | `leadership +0.15`, `defended +0.1` |
| **Never Renegotiates** | `haggle -0.2`, `charterHold +0.25` |
| **Reads The Sky** | `rumourCredibility +0.2`, `awareness +0.2` |
| **Owes The Room** | `debtHonour +0.3`, `allianceAffinity +0.2`, `retreat +0.05` |

**Carrying the thin combat keys (6):**

**First Through** (`hornCommitment +0.25`, `combatPower +1`),
**Hangs Back** (`hornCommitment -0.3`, `concealment +0.15`),
**Finishes It** (`executeDrive +0.25`, `killSanity +0.2`),
**Cannot Finish It** (`executeDrive -0.35`, `griefResist -0.15`),
**Grips Hard** (`wrestle +0.2`, `unarmedPower +1.5`),
**Fights Wounded** (`bleedResist +0.2`, `retreat -0.15`).

**Body and deprivation (6):**

**Long Wind** (`fatigueDay -3`, `pacing` floor),
**Heat-Bred** (`heatResist +0.3`, `coldResist -0.2`),
**Runs Cold** (`coldResist +0.3`, `heatResist -0.2`),
**Eats Late** (`hungerDrain -4`, `forage -0.04`),
**Thin Sleeper** (`fatigueNight -2`, `awarenessNight +0.4`),
**Heavy Bones** (`wrestle +0.15`, `climb` penalty via `concealment -0.1`).

**Earned, in the arena (6)** — the earned set is 25 against 124 rollable, and
earned traits are the ones a player actually notices arriving:

**Unbroken** (never below the near-death line, earned at day 8),
**Sleepless Week** (four consecutive nights on watch),
**Trapline** (five traps set),
**Mapmaker** (two hidden edges found),
**Kept The Peace** (three truces that ran their full term),
**Outlived The Pack** (last surviving member of an alliance of four or more).

Every one of the thirty carries only keys that already exist, which is the
rule the trait file's header sets: *a new trait costs a data row and no read
site at all.*

## 12.4 Repair four proficiencies, then add two

**Repair first** (§3.5), in this order:

1. **`signalling`** (99.6% untrained) — §1.11 proves it is structurally
   untrainable: its one site sits behind `tracking >= 3.0`, against a
   `tracking` population mean of 1.24. Lower `falseTrailSkill` to 0.5, train
   on the *attempt* rather than the success, and add two more sites: reading
   somebody else's false trail, and leaving a camp (`abandonedCamps` already
   fires in 45.5% of runs and is exactly "a mark somebody left").
2. **`intimidation`** (91.7%) — train on every fear point inflicted, not on
   the rare explicit intimidation beat.
3. **`oratory`** (91.0%) — train on every alliance hearing, charter swearing
   and bloc proposal, not on the treaty alone. This also unblocks §4.5.
4. **`readingPeople`** (88.3%) — train on every parley *attended*, not every
   bluff *called*. This unblocks §6.3.

**Then add two**, both taking over a gate that currently reads a raw attribute:

- **`husbandry`** — handling animals, live and dead. `butchery` covers what
  comes off a corpse; nothing covers the mutt encounter a tribute walks away
  from, the `Beast-Wise` trait, or the `fishing` item flag, all of which read
  raw attributes today. Read sites: `mutts.ts` evasion, `Item.fishing` use,
  `muttsSurvived`.
- **`endurance-craft`** → better named **`bracing`** — holding a position
  under pressure. `Fortified` (5.0% of stance-time) and `Patrolling` (0.9%)
  both resolve through raw `strength` and `willpower`; a skill that improves
  by digging in is the missing arc for the whole defensive half of the stance
  roster.

Nothing more than two, and neither until the four above are fixed.

## 12.5 Six new archetypes — with a balance gate attached

§8.1 shows that each of the last three batches landed at the bottom of the win
table. So the rule for this batch is two rules, not one:

> Each must hold a stance/objective/target combination nothing in the table
> holds, **and** must measure inside ±1.5 points of the field mean at
> n ≥ 1,600 before it merges.

Six candidates, each filling a hole the measured data names:

1. **The Quartermaster's Rival — `factor`.** Top objective bias `wait`, top
   stance `Patrolling`, target `richest`. `Patrolling` is the top stance bias
   of exactly one archetype (§8.1's table) and 0.9% of stance-time.
2. **The Bait — `lure`.** Top stance `Baiting`, objective `hold`, target
   `nearest`. `Baiting` is nobody's top bias, which is §3.4's finding.
3. **The Nurse — `orderly`.** Top stance `Tending`, objective `protect`,
   target `mostWounded`. `Tending` is nobody's top bias either.
4. **The Signaller — `beacon`.** Objective `reach`, stance `Fortified`, target
   `mostFamous`; signature is a deliberate position broadcast that buys
   sponsor trust. Gives `signalling` (§12.4) a constituency.
5. **The Drover — `drover`.** Target preference `strongest` with objective
   `flee` — the only archetype that picks the biggest threat and runs it into
   something. `flee` is nobody's top objective bias.
6. **The Inheritor — `inheritor`.** Objective `protect`, stance `Nursing`,
   target `rival`; signature fires on becoming an alliance's named heir.
   `succeededAsHeir` is stored and read by one achievement.

Three of the six exist specifically to give a top-bias constituency to
`Baiting`, `Tending`, `Patrolling` and `flee`, which is the same argument
AUDIT-6 used successfully for `wait` and `Nursing` — and which §3.4 shows has
to be paired with a precondition fix, because a bias toward a stance nobody
can enter is still nothing.

## 12.6 Two new stances, and one existing one to re-gate

**Re-gate first.** `Baiting` (1.9%) was written to convert fieldcraft's 72%
untriggered traps and has not (§3.4). Its precondition should read the
tribute's own trapline in adjacent zones. Do this before adding anything.

**Two new conditional stances**, each taking share from a specific place
rather than hoping for 1.5%:

- **`Withdrawing`** — takes from `Evasive` (25.7%, the second-largest pool).
  Evasive currently covers both "hiding" and "leaving"; `Withdrawing` is the
  second, with a real cost and a real payoff: transit is faster, awareness is
  worse, and it is the only stance that can be held while `transit` is active.
  The `transit` field exists, is set on every slow crossing, and no stance
  reads it.
- **`Bartering`** — takes from `Defensive` (37.0%, the largest pool). The
  parley layer produces 452 truces and 62 payments per 400 Games and has no
  stance of its own: a tribute who has decided their next move is a
  *negotiation* is currently indistinguishable from one who has decided to
  stand their ground. Preconditions: a non-hostile in the zone, a tradeable
  item or intel, and `readingPeople` above a floor — which gives that
  proficiency (§12.4) its second read site.

Both take from a pool above 25%, which is the condition §3.4 shows a new
stance needs in order to land above noise.

---

## Priority

If only a handful of things get done, this is the order.

**Red, this week:**

1. **§1.1** — make CI run `METRICS_RUNS=1600` (five guards are vacuous at
   400), then fix the `quiet` signature that the 1,600-run pass fails on.
2. **§1.2** — the Broker's phantom trait. One character, plus §1.5's guard.
3. **§1.3** — `pickIndex(4)` → `pickIndex(3)` in `rollBody`. One character,
   and it unbends the whole body distribution.
4. **§1.4** — merge the 34 duplicate achievements into 16, and add the
   identical-predicate guard so the seventeenth cannot be written.
5. **§1.11** — `signalling`'s self-gate. Two lines, and it brings a whole
   authored proficiency axis into the game.

**High value, low cost:**

6. **§1.9** — the procedural obituary. One line, 72 new death strings.
7. **§1.7** — four zone-effect kinds into the procedural draw. One array.
8. **§1.8** — the two inert signature combinations. Three lines.
9. **§1.6** — make the water-source census resolve rather than read the raw
   field, so it stops naming the wrong three arenas. No arena data changes.
10. **§4.6** — twenty archetype antipathy rows. Pure data.

**The real work, in descending order of effect on the game:**

11. **§3.5 / §12.4** — repair the remaining six dead proficiencies. This is
    the single change with the widest blast radius in the report: it unblocks
    §4.5 (bloc treaties), §6.3 (standoffs), §5.2 (hidden edges) and part of
    §8.3 (the trait win spread).
12. **§9.5 / §7.3** — 192 procedural biome events, and the six packs at the
    floor.
13. **§5.4 / §10.1** — break the authoring-to-the-template habit, starting
    with the forty-five seven-event set-piece packs.
14. **§9.4** — re-gate the fifteen unreachable AUDIT-7 achievements before
    adding §11.3's sixty.
15. **§2.1 / §2.2** — remappable shortcuts and a text-size preference. Both
    have been open for two audits.
16. **§4.2** — invert the hearing/expulsion ordering.
17. **§8.1** — the balance gate on new archetypes, applied retroactively to
    the four at the bottom.

## What this report is not asking for

- **More arenas.** Forty-five hand-authored arenas all carry every optional
  layer. The roster is complete; the depth per arena is not.
- **More names.** §11.4 proposes 200 because the request asked, and the pools
  are already above target. The mentor pools are the ones that would actually
  change a player's experience.
- **A new social subsystem.** Three ledgers close with zero unaccounted
  entries. The social layer's problem is fire rate, not architecture.
- **More balance knobs.** 2,364 across 133 groups, all referenced, with two
  checks guarding the discipline in both directions. That is enough.
- **Rewriting the check roster.** Sixteen checks, all green as CI runs them,
  one of which fails at the sample size its own guards need. The gaps are
  §1.1 (five guards vacuous at CI's run count), §1.5 (no cross-table
  reference check), §1.4 (no duplicate-predicate check) and a handful of
  ratchets with slack — additions, not replacements.
