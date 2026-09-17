# Survival Games — fifth full audit (12 sections)

> **Status: answered.** `CHANGELOG.md` records the fix pass on this branch.
> One finding was imprecise and is corrected in place: §4.2 said bloc treaties
> had no non-violent ending — they did (`"The agreement between the two groups
> runs out"`), filed as ambient; the probe's regex missed it. It is now
> `important`, which was the actual gap.

## Context

Taken against `main` at `fed43bc`, after `AUDIT.md`, `AUDIT-2.md`, `AUDIT-3.md`,
`AUDIT-4.md` and the four fix passes recorded in `CHANGELOG.md`. Written to the
twelve headings the request named. **Nothing below is merged into a neighbouring
section.** Where a finding belongs in two places it is stated twice, in each
section's own terms, because a report whose sections quietly borrow from each
other cannot be read one section at a time.

Every number here was measured on this commit, either by the repository's own
check roster or by six throwaway probes written against `Simulator`'s public API
and deleted afterwards. Where this report says "never", it means a counter that
stayed at zero across a stated number of complete runs. Where it says "cannot",
it means a code path proved unreachable by reading, not by sampling.

### The check roster, on this commit

Every one of the sixteen checks passes.

| check | result |
|---|---|
| `lint` | clean |
| `test:sim` (400 runs) | passes, no invariant violations |
| `test:metrics` (400 runs) | 25/25 regression guards hold |
| `test:metrics` (1,600 runs) | 25/25 guards hold; **9 indicators short of their design goal** |
| `test:decisions` (40 runs, 5,701 tribute-cycles) | passes; stance-best 52.9%, destination-best 66.7% |
| `test:achievements` (500 runs) | passes; 193 entries, **11 never unlock**, 7 near-automatic |
| `test:arenas` | passes; 45 authored arenas + procedural biomes, 52 mutt rosters, 216 mutts |
| `test:flavor` | passes; 49 arena packs, 0 under the hard floor, **45 under the soft target** |
| `test:knobs` | 2,143 knobs across 131 groups, all referenced |
| `test:undeclared-knobs` | no new drift |
| `test:names` | 3,200 names + mentors; 191 names in two pools, none in three |
| `test:predicates` | clean; 43 `traits.includes()` sites (ceiling 44), 215 achievement reads |
| `test:zone-features` | every zone authors an interior |
| `test:storage` | migration cases pass |
| `test:arena-layout` | 165 layouts, no label collisions, 46px touch targets |
| `test:ui-affordances` | 30 hover-only hints (**at ceiling**), 0 unnamed value hints |

**The roster is green and the repository is in the best shape of the five
audits.** Several of `AUDIT-4`'s headline findings are genuinely closed, and this
report says so where it found them closed rather than restating them:

- `irradiated` is no longer the dead zone effect — it fires 139 times per 300
  runs, ninth of ten (§1 notes the new floor).
- Quirks are no longer flavour-only: **85 of 85** now carry `QUIRK_MODS` rows
  against 41 distinct `TraitMod` keys. `AUDIT-4 §6.3` is closed.
- Alliance roles are no longer vestigial: **95.5% of alliance samples of size ≥2
  name at least one role**, against `AUDIT-4 §4.2`'s "half name exactly one".
- `targetDraw` is filled on 11 of 15 archetypes, against `AUDIT-4 §8.3`'s one.
- The whole-field archetype spread has come from 4.56x (at the unjudgeable 400-run
  sample) to **2.94x at n=1,600**, against a goal of 2.3x.

What this report finds instead is a different shape of problem, and it recurs in
every section below: **the five newest hand-authored arenas were shipped without
the layer that makes an arena an arena**, and nothing in a sixteen-check roster
noticed. That is §1.1, and it is also §2.2, §5.1 and §9.3, in each of those
sections' own terms.

### The probes

Six probes, all written against `Simulator`'s public API (`processTraining`,
`processInterviews`, `startGames`, `processBloodbath`, `processTurn`,
`getState`) and all deleted after measurement:

1. **Death-cause probe** — 300 runs across all 45 arena ids plus procedural;
   6,912 deaths; buckets every `causeOfDeath` string and then re-buckets by
   template.
2. **Subsystem-breadth probe** — 200 runs; quirks, laws, epithets, objectives,
   proficiency means, per-cycle stay/move.
3. **State-inspection probe** — 300 runs; zone effects, Quells, alliance-role
   histograms, per-cycle alliance sampling.
4. **Log-visibility probe** — 300 runs, 383,520 log lines; matches 37 named
   subsystems against the text they actually emit.
5. **Bloc/camp/epithet probe** — 400 runs; corrects probe 4's regexes against
   the exact strings the engine writes.
6. **Achievement-blocker probe** — 400 runs, 9,600 tributes; scars, `intelSold`,
   `visitedZones`, `metAnybodyAfterBloodbath`, run length.

Plus four static probes over the data tables (event field usage, arena-event
reachability, dead exports, signature coverage) that need no simulation.

---

## §1 — All bugs

### 1.1 Five of the forty-five hand-authored arenas have no signature at all, and `runArenaSignature` silently no-ops in them

**This is the most serious finding in the report.**

`engine/arenaSignature.ts` is the file that gives each arena a rule of its own —
the thing the Tidewrack does that the Kiln does not. Its dispatcher is:

```ts
export function runArenaSignature(ctx: SimContext) {
    if (getAlive(ctx.state).length <= ESCALATION.finalistCount) return;
    const signature = SIGNATURES[ctx.state.arena.id];
    if (signature) { signature(ctx, cycle, rng); return; }
    const rule = ctx.state.arena.signatureRule;
    if (rule) runDeclarativeSignature(ctx, rule, cycle, rng);
}
```

Two ways in. `SIGNATURES[id]` is populated by hand and has **40 entries**.
`Arena.signatureRule` is rolled in `generateArena` — **and only there**, so it
exists on procedural arenas and on nothing else.

`ARENAS` carries **45** hand-authored arenas. Five of them are in neither set:

| arena | name | `SIGNATURES` entry | `signatureRule` | `SIGNATURE_BLURBS` entry |
|---|---|---|---|---|
| `tidewrack` | The Tidewrack Flats | — | — | — |
| `thresher` | The Thresher Floor | — | — | — |
| `vigil` | The Vigil | — | — | — |
| `saltworks` | The Saltworks | — | — | — |
| `kiln` | The Kiln | — | — | — |

In these five arenas `runArenaSignature` is called once per day and once per
night for the whole run and returns without doing anything, every single time.
The arena has a law, a zone graph, a climate, a mutt roster and an event pack,
and it has **no rule of its own** — which is precisely the gap that
`AUDIT-3` introduced the declarative `SignatureRule` grammar to close for
procedural arenas, and that is now open again for hand-authored ones.

The failure is a shipping-order failure, not a design one. These five arenas
were the most recent batch added. Everything the `validate-arenas` check tests —
zone connectivity, flavour packs, ≥12 authored events, climate labels, mutt
terrain coverage, law enforcement — they pass. **No check in the roster asserts
that an arena has a signature.** The `describeSignatureRule` function that would
have made the gap visible in the UI is itself dead code (§1.3).

**Two fixes, and both are wanted:**

1. Add the guard to `scripts/validate-arenas.ts`: every id in `ARENAS` must
   appear in `SIGNATURES` or carry a `signatureRule`, and must have a
   `SIGNATURE_BLURBS` entry. This is five lines and it is the reason the bug
   survived a batch of five arenas rather than one.
2. Write the five signatures. Each of these arenas has an obvious one sitting in
   its own premise, and §5.7 proposes them.

### 1.2 The same five arenas have no `SIGNATURE_BLURBS` entry, so the setup screen silently drops a row

`screens/SetupScreen.tsx:818-823` renders the signature line as:

```tsx
{selected ? a.description : (SIGNATURE_BLURBS[a.id] ?? a.description)}
...
{selected && SIGNATURE_BLURBS[a.id] && (<div>⚙ {SIGNATURE_BLURBS[a.id]}</div>)}
```

`SIGNATURE_BLURBS` has 40 entries for 45 arenas. For the five in §1.1 the `⚙`
row does not render at all — there is no fallback, no placeholder, and nothing
in the layout that suggests a row is missing. A player comparing The Kiln
against The Vigil against The Saltworks sees three arenas that differ only in
their descriptions, because mechanically, on this commit, they do.

This is filed here as a bug rather than in §2 because the missing row is a
*consequence* of §1.1, not an independent UI decision. §2.2 restates it as the
UX problem it also is.

### 1.3 `describeSignatureRule` was written to close exactly this gap and is never called

`engine/arenaSignature.ts:1911` exports a 20-line function that renders a
`SignatureRule` into a sentence ("every night, wherever the most tributes are
standing, something is let loose, with a warning the cycle before"). It has three
complete lookup tables — `when × where × what` — and one `telegraphed` clause.

Nothing in `src/` or `scripts/` calls it. Grep returns exactly one hit: the
definition.

So every procedural arena — which is the *only* kind that carries a
`signatureRule` — falls through to `SIGNATURE_BLURBS[a.id] ?? a.description` and
gets the generic description, despite the engine knowing precisely what that
arena's rule is and despite a function existing whose entire purpose is to say
so. `hasSignature` (the next export down, documented "used by the UI to explain
it") is dead in the same way.

### 1.4 `LEGENDARY_ITEM_TEXTS` is twelve authored lines that no code path can reach

`data/flavorText.ts:3492` declares a twelve-entry pool with `{item}`, `{base}`
and `{owner}` placeholders, written for the moment a weapon earns a name:

> `'{item} went into the arena as an ordinary {base} and came out of it with a name. It killed for {owner}, and before {owner} it killed for somebody else.'`

`engine/legendaryItems.ts:97` — the only site that names a weapon — logs a
hard-coded sentence instead:

```ts
ctx.logEvent(
    `The commentary has stopped calling the ${weapon.name.toLowerCase()} in ${wielder.name}'s hand a ${weapon.name.toLowerCase()}. `
    + `As of tonight it is ${weapon.legendName}, and it will be ${weapon.legendName} in the record books whoever is holding it at the end.`,
    ...
```

Measured: weapons are named in **91.3% of runs, 2.11 times per run**. So the game
reaches this moment roughly twice a run, in nine runs out of ten, and prints the
same sentence every time — while twelve variants written for it sit unreferenced
one file over.

This is *not* the same finding as `AUDIT-4 §1.3`. That one was about
`LEGENDARY_ITEM_NAMES` (the name list), and it is closed — the names are drawn,
sampled against the composed arena-derived names exactly as the fix describes.
`LEGENDARY_ITEM_TEXTS` is the adjacent pool and was never wired.

**Also note:** `scripts/check-flavor-pools.ts` reports "21 flavour pools" and
"147 nested pools" and does not see this one, because it enumerates a hand-kept
list rather than every `export const *_TEXTS` in `flavorText.ts`. There are
**51 such exports**. A pool that is authored, never drawn, and invisible to the
pool checker is the exact failure mode that checker exists to prevent; §6.5
proposes the guard.

### 1.5 Seventeen exported symbols are dead — referenced nowhere, including in their own file

Measured by resolving every `export const|function|interface|type|class` in
`src/` against every reference in `src/` and `scripts/`. A symbol is listed here
only when its **total** occurrence count across both trees is 1 — the definition
itself.

| symbol | file | what it was for |
|---|---|---|
| `describeSignatureRule` | `engine/arenaSignature.ts` | §1.3 — renders a procedural arena's rule |
| `hasSignature` | `engine/arenaSignature.ts` | §1.3 — "used by the UI to explain it" |
| `LEGENDARY_ITEM_TEXTS` | `data/flavorText.ts` | §1.4 — twelve naming lines |
| `evaluateInRunNearMisses` | `data/achievements.ts` | mid-run near-miss surfacing |
| `achievementsAvailableIn` | `data/achievements.ts` | filtering the list to this arena |
| `downloadChronicle` | `utils/chronicle.ts` | superseded by `downloadChronicleAs` |
| `zoneAcoustics` | `engine/map.ts` | per-zone sound propagation |
| `isSevered` | `engine/map.ts` | edge severance predicate |
| `controllingAlliance` | `engine/zoneControl.ts` | who holds the horn |
| `victorsOf` | `engine/victory.ts` | |
| `hasBackpack` | `engine/items.ts` | |
| `fortifiedBond` | `engine/stanceBeats.ts` | |
| `ALL_TRAITS` | `data/traits.ts` | |
| `isInterviewPersona` | `data/personas.ts` | |
| `HOF_STORAGE_KEY` | `utils/hofStorage.ts` | |
| `PANEM_STORAGE_KEY` | `utils/panemStorage.ts` | |
| `resetEmptyPickCount` | `utils/rng.ts` | |

Three of these are features, not leftovers. `evaluateInRunNearMisses` is a
complete, defensive (try//catch per predicate), `availableIn`-aware function that
answers "what is this run two steps away from?" **while the run is still
running** — and 122 of 193 achievements carry the `nearMiss` closure it needs.
Near-misses are shown only on `EndScreen`, after nothing can be done about them.
`zoneAcoustics` reads a `zoneFeatures().acoustics` field that every one of the
415 zones authors and nothing consumes.

A further **146 exports** are referenced only inside their own defining file.
That is an API-surface smell rather than a bug — `setTrap`, `buildShelter`,
`plantRumour`, `assignRoles` and the rest are all live, called from a sibling
function in the same module — and it is listed here only so the seventeen above
are not confused with it.

### 1.6 `arms-dealer` is labelled a "possible?" achievement but is gated by a path a victor almost cannot take

`data/achievements.ts:689` — `test: (_s, v) => !!v && (v.intelSold ?? 0) >= 1`.

`intelSold` is written at exactly one site: `engine/parley.ts:413`, in the branch
where the **weaker** party to a lopsided meeting buys their way out by selling
what they know. Measured over 400 runs and 9,600 tributes:

- tributes with `intelSold > 0`: **111 (1.16%)**
- **victors** with `intelSold > 0`: **4 of 389 (1.03%)**

So the achievement is reachable at roughly 1% and the 500-run check happened to
miss it. That part is fine. What is not fine is the label: the README defines
**Possible?** as "the simulation is believed to be able to do this and no
measured run has ever done it", and this one has measured runs — four of them, in
a 400-run probe. It should be `legendary` and the check should stop reporting it
as never-unlocked. The same applies to `cartographer` (8 tributes of 9,600 walked
a whole map; none was the victor) and `the-quiet-one`.

### 1.7 `scarred-and-standing` is unreachable in practice, and the reason is a threshold three layers away

`test: (_s, v) => Object.values(v?.scars ?? {}).filter(Boolean).length >= 2`.

Measured over 400 runs:

- tributes who ever carried a scar: **277 of 9,600 (2.89%)**
- tributes who ever carried **two**: **6 of 9,600 (0.06%)**
- **victors** with two: **0**
- victors with one: 5 of 389

`engine/wounds.ts:110` sets a scar at `grade >= SCARRING.scarsAtGrade`. The
comment there records that this was lowered from `MAX_INJURY_GRADE` precisely
because grade 3 is "the grade at which a wound kills you rather than the grade at
which it marks you — 2 of 1,920 tributes ever reached it alive". The lowering
worked, and scars now exist. But two scars on the same body, on the one tribute
who survives, is still a compound-improbability event, and the achievement asks
for exactly that.

This is a genuine bug in the achievement, not in `wounds.ts`: it reads a real
field, which is written, at a rate the entry's author clearly did not measure.
Either lower it to one scar and rename it, or widen the predicate to
"scars + permanent conditions" — `scars` is keyed by `InjurySite`, which is
`keyof Injuries` and so already includes `frostbitten`, `burned`, `infected` and
`poisoned` alongside `legs`/`arms`/`torso`/`head`. Measured site distribution
across 277 scarred tributes: `legs` 112, `infected` 41, `torso` 38, `poisoned`
22, `head` 20, `frostbitten` 19, `burned` 16, `arms` 15.

### 1.8 `the-short-week` asks for a three-day Games and the default config cannot produce one

`test: state => state.day <= 3 && state.tributes.some(t => t.status === 'alive')`.

Measured over 400 runs on `DEFAULT_GAME_CONFIG` across every arena: **0 runs
finished on day 3 or earlier.** Mean run length is 9.2 days; the `run length
spread (days, sd)` indicator reads 2.15, so a three-day run is roughly three
standard deviations below the mean.

It is reachable on a two- or three-district field — `test:sim` sweeps those and
reports runs ending in a handful of days — but the achievement carries no
`availableIn` and the discovery layer advertises it on every run. Two of the
eight `compressed`/`blitz` temperaments shorten the calendar, and combining one
with a small field is the honest route; the entry should say so in its hint.

### 1.9 `the-unwitnessed` reads a field that is true for a third of the cast and can never be true of the victor

`test: (_s, v) => !!v && v.metAnybodyAfterBloodbath !== true`.

Measured: **3,326 of 9,600 tributes (34.6%)** finish a run having never stood in
a sector with another living tribute after the bloodbath. It is not a rare state.
It is a rare state *for a victor*, and structurally so: the border collapse and
the `ESCALATION.finalistCount` endgame exist to force the last survivors
together, so the final tribute standing has met somebody by construction in
almost every run.

This is a design collision between two systems, and it is worth stating plainly
because it recurs: **eight of the eleven never-unlocked achievements are
victor-scoped predicates over states that are common in the field and rare-to-
impossible in a winner.** §11.2 treats that as a category problem.

### 1.10 Minor and cosmetic

- **`quaking` and `swarming` are still the thin end of the zone-effect
  distribution.** Measured per-cycle samples over 300 runs: `fogbound` 1,670,
  `stripped` 809, `flooded` 756, `burning` 639, `contaminated` 628, `blooming`
  614, `swarming` 369, `frozen` 354, `quaking` 304, `irradiated` 139. The
  top-to-bottom spread is **12.1x**, down from `AUDIT-4 §5.5`'s 30x, and
  `irradiated` is alive. The finding is downgraded, not closed.
- **`charisma` is a dodge stat on 4 of 1,241 events that have one (0.3%).**
  Distribution: `intelligence` 431, `agility` 421, `stealth` 138, `willpower`
  124, `endurance` 78, `strength` 45, `charisma` 4. §5.5 treats this as an arena
  problem; it is listed here because four is close enough to zero that the
  column reads as an authoring accident rather than a decision.
- **`hunger` is set on 13 of 1,522 arena events (0.9%)** against `thirst` on 71
  and `fatigue` on 348. An arena event that makes you hungry is a shape the
  schema supports and the content almost never uses.
- **The `Alliance` interface documents `members` and the field is `memberIds`.**
  Not a bug in shipped code — every read site uses `memberIds` — but three of the
  doc comments above it (`§4.2`, `§4.5`) talk about "members", and a probe
  written from the comments crashes. Cosmetic, worth a word.

### 1.11 What this section looked for and did not find

Stated so the green results are on the record rather than implied:

- **Determinism.** `Math.random` appears seven times, all of them in
  `App.tsx`/`SetupScreen.tsx`/`gameStore.ts` seed generation and one audio
  buffer. Zero occurrences in `src/engine/` or `src/data/`. No
  `sort(() => rng() - 0.5)` anywhere (the `validate-arenas` scanner covers this
  and is clean). `Date.now()`/`new Date()` appear only in `replayHooks.ts`, both
  behind an injectable `now` parameter.
- **Unreachable arena events.** Static check over all 1,522 authored events:
  **0** whose `requires.law` names a law their arena does not carry (reading
  both `Arena.law` and `Arena.laws`, which is what the engine does), **0** whose
  `terrains` match no zone in their own arena, **0** broken `chain` targets,
  **0** `oncePerRun` events without an `id`.
- **Crashes.** None. `test:sim` at 400 runs and six probes at 200–400 runs each
  completed without an exception.
- **Invariant violations.** None.

---

## §2 — All QOL, UI and UX updates needed

### 2.1 The setup screen cannot tell a player what five of the arenas do, because there is nothing to tell

Restated from §1.1/§1.2 in interface terms, because the player-facing shape is
different from the engine-facing one.

The arena picker's whole information design rests on one row per arena: the
`⚙` signature line, which is the single sentence that says what makes this arena
different. For The Tidewrack Flats, The Thresher Floor, The Vigil, The Saltworks
and The Kiln that row does not render. There is no "no special rule" placeholder,
no dash, no greyed line — the element is conditionally absent, so the card just
gets shorter.

The UX cost is worse than a missing sentence. The picker is the screen where a
player decides what kind of Games they want, and five of the forty-five options
are, from that screen, indistinguishable from each other except by prose. Add the
five blurbs (after §5.7 gives them something to describe) and render an explicit
placeholder when one is genuinely absent, so a missing row is visibly a missing
row.

### 2.2 The near-miss layer exists, is 122 achievements deep, and is only ever shown after the run is over

`EndScreen.tsx:203` is the only consumer of `outcome.nearMisses`. 122 of 193
achievements carry a `nearMiss` closure that phrases the gap in words
("one kill short", "survived to day 9 of 12"). `evaluateInRunNearMisses` — which
is written to run this same machinery on a live, unfinished state, skips anything
`availableIn` says this arena cannot produce, and wraps each predicate in
try/catch so mid-run state cannot break the UI — is dead code (§1.5).

The QOL gap: during a run the player has no idea that this Games is two zones
from `cartographer` or one scar from `scarred-and-standing`. After the run they
are told, at the exact moment the information is worthless. Wiring
`evaluateInRunNearMisses` into a collapsed panel on `GameScreen` costs nothing in
engine terms — the function is written, tested by `check-achievements`, and
defensive by construction.

### 2.3 Hover-only affordances are at the ratchet ceiling, which means they have stopped falling

`test:ui-affordances` reports **30 hover-only hints on controls against a ceiling
of 30**, and 0 value hints with no accessible name. The second number is the one
that matters for screen readers and it is clean. The first is a touch problem: on
a phone, thirty controls carry information that cannot be read without firing
them.

Heaviest offenders: `SetupScreen.tsx` 5, `HallOfFameScreen.tsx` 4,
`RosterScreen.tsx` 4, `ChronicleFilters.tsx` 3, `DossierPanel.tsx` 3.

Separately, there are **106 raw `title=` attributes** across 17 components, with
`TributeModal.tsx` (29) and `DossierPanel.tsx` (23) holding half of them. Most
are paired with an accessible name and so are invisible to the checker — the
checker is right not to fail them — but `title` is still the one tooltip
mechanism that no touch device shows and no screen reader reads consistently.
The two dossier components are where a `Hint`/`Glossed` conversion buys the most.

**A ceiling that has been reached is a ceiling that should be lowered.** The
ratchet's job is to prevent regressions; at 30/30 it is no longer driving
anything down. Lower it to 24 and clear `SetupScreen` and `HallOfFameScreen`.

### 2.4 Two components still carry no `aria-` or `role` at all

| component | `aria-`/`role` count |
|---|---|
| `RunProfileCard.tsx` | **0** |
| `VictorArc.tsx` | **0** |
| `ErrorBoundary.tsx` | 1 |
| `BodyDiagram.tsx` | 2 |
| `HofAggregates.tsx` | 2 |
| `RelationshipGraph.tsx` | 2 |
| `Stat.tsx` | 2 |

`AUDIT-4 §2.4` reported four at zero; two of those are fixed. `VictorArc` is the
worse of the two remaining — it is a narrative summary of the run, which is
exactly the content a screen-reader user most wants and least can reconstruct
from a graph. `BodyDiagram` at 2 is also thin for what it is: a spatial
representation of injury state with no text equivalent.

### 2.5 The feed is 1,278 lines per run and its category mix is still lopsided

Measured over 300 runs, 383,520 log lines, by `category`:

| category | lines | share |
|---|---|---|
| training | 45,478 | 11.9% |
| sanity | 44,217 | 11.5% |
| travel | 41,461 | 10.8% |
| alliance | 40,413 | 10.5% |
| system | 38,682 | 10.1% |
| interview | 38,642 | 10.1% |
| survival | 36,707 | 9.6% |
| combat | 29,431 | 7.7% |
| sponsor | 11,975 | 3.1% |
| arena | 9,202 | 2.4% |
| loot | 8,690 | 2.3% |
| gamemaker | 7,271 | 1.9% |
| injury | 7,038 | 1.8% |
| hazard | 6,067 | 1.6% |
| death | 6,025 | 1.6% |
| feast | 4,457 | 1.2% |
| kill | 4,390 | 1.1% |
| mutt | 3,700 | 1.0% |
| betrayal | 2,219 | 0.6% |
| romance | 1,714 | 0.4% |

`sanity` is down from `AUDIT-4 §2.5`'s 12.9% to 11.5% — the sanity-band work
helped — but it is still the second-largest category in the game, larger than
`combat`, and eight times `kill`. The three categories a viewer is most likely to
have come for (`kill`, `betrayal`, `romance`) total **2.1%** of everything said.

The filter groups and the density control both exist and work. The gap is that
the *default* density shows a feed whose modal line is a training note or a
sanity drift, and a new player's first impression of the game is therefore its
least dramatic layer. A default density that weights `important` lines harder
would change nothing mechanically and a great deal experientially.

### 2.6 The arena a player is standing in is described by a 30-line generic pool when the arena's own pack is exhausted

`check-flavor-pools` reports the generic fallback at 30 events and **45 of 49
arena packs below the soft target of 40**, with 5 sitting exactly on the hard
floor of 24 — and those five are, again, `tidewrack`, `thresher`, `vigil`,
`saltworks`, `kiln`.

Measured per-run reach is 3.5+ events of a pack per Games (`test:sim`'s guard),
so a single run does not exhaust a 24-event pack. The UX cost lands on the second
and third run in the same arena, which is where a 24-pack starts repeating and a
40-pack does not. §9.2 treats this as a replayability problem; here it is simply
the reason an arena stops feeling like itself.

### 2.7 Smaller items

- **`GameScreen` has a good keyboard layer and does not advertise all of it.**
  `p` toggles play/pause, `1`–`9` mute category groups, `0` resets filters, and
  each announces itself through a live region. The help overlay covers these. The
  scrubber's `←`/`→` and the palette's `⌘K` are documented elsewhere. Worth one
  consolidated shortcut sheet rather than three.
- **The name pool is gender-binary at the data layer.** `DISTRICT_NAMES` is
  `Record<number, Record<'Male' | 'Female', string[]>>` — 100 + 100 per district
  across 16 districts. There is no neutral pool and no way to reap a tribute
  outside the two. This is a data-shape decision with a UI consequence and it is
  restated in §10.3 and §12.4.
- **`ChronicleFilters` carries 4 `title=` and 3 hover-only hints** in a component
  whose entire job is to be operated. It is the densest ratio in the tree.
- **`OddsSparkline`, `ReplayFallenStrip` and `VictorInterviewScreen` sit at 3
  aria attributes each** — enough to not fail the checker, thin for what they
  show.

---

## §3 — Tribute logic: updates, robustness and more complexity

### 3.1 Where the model is now, measured

A tribute on this commit carries: six attributes, nine proficiencies, a trait
row resolved through 51 named `TraitMod` hooks, a quirk with its own mod row, an
archetype with 18 columns, a persona, a stance, an objective, a resolve value, a
sanity band, a fear map, a memory of the map, a relationship row per other
tribute, an inventory with condition, an injury map with per-site severity and
recovery progress, and a notoriety/epithet layer.

Two of `AUDIT-4`'s three complaints about it are closed:

- **Stance thrash and inertia.** `test:decisions` over 5,701 tribute-cycles:
  stance held = best **52.9%**, rank histogram `0:52.9 / 1:22.7 / 2:15.1 /
  3:9.3`, destination = best **66.7%**, destination in the bottom fifth of its
  own scoring **2.0%**. A tribute picks its best option half the time and a
  top-three option 91% of the time, which is the right shape for an agent that
  is meant to be a person rather than a solver.
- **Sanity as a two-state flag.** Time at the sanity floor is **17.0%** at
  n=1,600 (was 31.4%), time in the middle bands **52.6%** (was 22.3%). The bands
  are real now. The floor is still above its 15% design goal.

### 3.2 Tributes stay put 53.6% of cycles and see 29.8% of the map

Measured over 200 runs, per living tribute per day/night phase: **53.6% of cycles
end in the zone they started in.** `AUDIT-4 §3.3` measured 71.4%, so this is a
substantial improvement and the movement work landed.

The consequence has not moved as much. Measured over 400 runs and 9,600
tributes:

- mean share of an arena's zones a tribute personally stands in: **29.8%**
- the largest number of distinct zones any single tribute stood in, in 400 runs:
  **10**
- tributes who walked a whole arena: **8 of 9,600 (0.08%)** — all of them in the
  six- and seven-zone arenas (`warren`, `saltflats`)

So the average tribute experiences under a third of the map they are standing on,
and in the 12- and 13-zone arenas (`concrete`, `tempest`, `menagerie`,
`carnival`, `labyrinth`, `ashgrove`, `redcathedral`, `storywood`) the tail of the
map is functionally scenery. This is the ceiling behind `cartographer` never
unlocking (§1.6) and behind the arena-event reach numbers in §5.

**What would move it, in order of cost:**

1. **Give `objective: 'reach'` somewhere further to go.** `reach` is already the
   second-most-common objective (1,404 of 4,808 sampled, 29.2%); it simply
   resolves close. A destination-scoring term that rewards unvisited zones
   directly — the same shape as the existing danger and resource terms — would
   spend the movement budget that already exists on new ground.
2. **Make the map worth reading.** `zoneAcoustics` is dead (§1.5) and
   `zoneSightlines` exists and is live. A tribute who can *hear* two zones away
   has a reason to walk toward or away from a specific one.
3. **Let the arena push.** Four of the seven `EdgeRule` kinds exist on a handful
   of edges (§5.6); `tidalBorders` and `meltingGround` both re-cut the map and
   both appear in exactly one arena each.

### 3.3 Proficiencies have a 2.1x spread and medicine barely grows

Measured mean end-of-run proficiency across 200 runs, all nine:

| proficiency | mean |
|---|---|
| crafting | 2.29 |
| melee | 2.17 |
| climbing | 1.76 |
| swimming | 1.70 |
| forage | 1.55 |
| tracking | 1.42 |
| ranged | 1.40 |
| persuasion | 1.40 |
| **medicine** | **1.07** |

`AUDIT-4 §3.4` reported "three of nine barely exist, one barely grows". The
spread is now 2.1x rather than the wider figure that report measured, and the
bottom four are clustered — but `medicine` is still the outlier, at 1.07 against
a field mean of 1.64.

The cause is structural and is worth naming: a tribute practises medicine only
when there is a wound to treat and a supply to treat it with, and the
`noHealing` law, the scarcity of `medical` items (7 of 52 item kinds) and the
fact that **deaths from untreated bleeding are down to 5.9%** all reduce the
occasions. The system worked: bleeding is no longer the top killer, and the cost
is that the skill for stopping it has nothing to do. This is a good problem, and
the fix is to give medicine non-emergency work — treating fatigue, sanity, an
ally's infection before it is critical — rather than to raise its growth rate.

### 3.4 Where the tribute could be more complex

Each of these reads state the model already writes:

1. **Handedness is declared and asymmetric and does almost nothing.**
   `types.ts:344` — "which hand. Makes `favouring` and arm scars asymmetric."
   `updateFavouring` in `wounds.ts` is exported and referenced only inside its own
   file. An arm wound on the dominant side should cost more than on the other,
   and the field is there to say which.
2. **`intelSold` is a whole economy with one seller.** 1.16% of tributes ever
   sell what they know, all through one `parley.ts` branch. The information
   itself — `rumours.ts` has a complete plant/spread/debunk model — is the thing
   being sold, and only the losing party in a shakedown ever sells it.
3. **Memory is unreliable and nothing reads it.** `memoryUnreliable`,
   `regrowthDueCycle` and `improveRead` in `engine/memory.ts` are all
   file-internal. A tribute who *misremembers* where the water was is one of the
   cheapest sources of genuine surprise in a simulation like this.
4. **Sleep deprivation is modelled and file-internal.** `sleepDeprivation` and
   `sleepDropChance` in `survival.ts`, same pattern.
5. **Composure** (`engine/composure.ts`) and **resolve** (`engine/resolve.ts`)
   are separate systems that both answer "will they keep going", and
   `resolveDrift` is the third-most-common trait mod (13 traits carry it).
   Whether these should be one axis is worth a deliberate decision rather than an
   accumulation.

### 3.5 Robustness

- **No crash, no invariant violation** across `test:sim` at 400 runs and six
  probes at 200–400 runs.
- **Achievement predicates are the crash test** and all 193 evaluate cleanly
  over several hundred arbitrary end-states with optional fields missing.
- **`test:predicates` reports 43 hard-coded `traits.includes('X')` sites against
  a ceiling of 44.** Heaviest: `Pacifist` 6, `Softhearted` 5, `Ruthless` 4,
  `Bloodthirsty` 4, `Merciful` 3. This is the ratchet `AUDIT-4 §8.6` installed
  at 56 and it has come down 13. Like §2.3's, it is close enough to its ceiling
  that the ceiling should be lowered to keep it moving.
- **The one robustness gap this audit found is §1.1**: a whole engine subsystem
  silently absent for 11% of arenas, with no check asserting its presence.

---

## §4 — Tribute relationships and alliances: improvements and updates

### 4.1 What is working, measured at n=1,600

| indicator | measured | guard | goal |
|---|---|---|---|
| alliance samples of 3 or more | **54.3%** | ≥30% | — |
| runs with star-crossed lovers | **16.6%** | 5–22% | 10–15% |
| vengeance sworn per run | **11.26** | ≥0.75 | — |
| betrayals per run | 5.99 | — | — |
| organic groups of 3+ per run | 4.61 | — | — |

Alliance size distribution over 400 runs (per-cycle samples): size 2: 3,074 /
size 3: 1,418 / size 4: 951 / size 5: 724 / size 6: 358 / size 7: 23. A healthy
curve — pairs dominate, and the long tail exists.

**`AUDIT-4 §4.2` is closed.** Measured over 300 runs, 7,302 per-cycle samples of
alliances of size ≥2:

- **95.5% name at least one role**
- roles-named histogram: `0: 330` / `2: 3,791` / `3: 413` / `4: 2,768`
- role kinds: `muscle` 6,972, `medic` 6,669, `scout` 3,184, `quartermaster` 3,068

The previous report's "half name exactly one, and it is the one with no combat
effect" is gone: the modal alliance names two roles, and the four-role alliance
is the second-most-common shape.

### 4.2 Bloc treaties are agreed in 38.8% of runs and resolve on screen in about 9%

This is `AUDIT-4 §4.3` restated with the numbers it lacked, and it is still open.

Measured over 400 runs, matching the exact strings `engine/blocTreaty.ts` emits:

| moment | line | runs |
|---|---|---|
| agreed | `"agree a truce between their groups"` | **38.8%** |
| broken by a kill | `"takes the agreement between the two groups with them"` | **1.3%** |
| arithmetic end | `"an arithmetic problem rather than a moral one"` | **2.8%** |
| defected from | `"the agreement was made by somebody else"` | **5.0%** |

`state.blocTreaties` is non-empty in **38.3%** of runs, which matches the
agreement rate — so the state is written and persists correctly, and
`blocTreatyHolds` is read in `combat.ts` at two sites, so the treaty genuinely
suppresses fights while it holds. The mechanic works.

What does not happen is the payoff. Roughly three-quarters of agreed treaties
never produce a line about how they ended. A treaty between two packs is one of
the biggest social objects the game can build, and in most runs the audience sees
it formed and then sees it silently stop mattering when one pack is dead.

**The fix is a fourth ending, not a rebalance of the three.** The three endings
that exist are all violent or arithmetic; the missing one is *expiry* — a treaty
whose parties simply drift apart, or whose surviving members merge, or which
outlives one of its two blocs. Log it.

### 4.3 The relationship layer's depth is real and almost entirely invisible

Restated from §2 in relationship terms because the numbers are different.

Live and measured per run over 300 runs:

| system | lines/run | runs seen |
|---|---|---|
| debts incurred | 1.35 | 71.3% |
| truces held | 2.71 | 83.7% |
| charter set | 6.15 | 99.7% |
| charter breached / hardened | 0.67 | 46.3% |
| vengeance sworn | 13.24 | 100% |
| downed-and-rescued | 1.27 | 72.7% |
| **rumour: planted lie** | **0.42** | **31.7%** |
| **rumour: debunked** | **0.01** | **1.3%** |
| rumour: witness report | 2.30 | 94.0% |

The charter is still the best-built thing in this layer — it fires in
essentially every run, it hardens its own terms in response to a breach, and the
breach line names who nobody is looking at. Debts, truces and rescues are all
solidly present.

**Rumours are the exception and the gap is specific.** The truthful half — a
witness reporting what they actually saw — fires 2.3 times a run in 94% of runs.
The *interesting* half, a tribute deliberately planting something false, fires
0.42 times a run in under a third of runs, and the moment the lie is discovered
fires **once every 77 runs**. `plantRumour` is a complete 60-line function with a
mark-selection model. The payoff — walking to a zone and finding nothing anybody
described, unable to remember who said it — is written at `rumours.ts:313` and is
essentially never seen.

### 4.4 Where the social layer could go deeper

1. **Reputation should be transitive.** `relationships.ts` tracks a trust value
   per pair and `trustHistoryOf` is dead code. Betraying A in front of B should
   cost you with B, and `BETRAYAL_WITNESS_TEXTS` exists as a pool — the witness
   moment is authored. Whether the *number* moves is what is missing.
2. **Alliances should be able to recruit against somebody.** `hatesArchetypes`
   is filled on 9 of 15 archetypes and drives targeting; nothing turns it into a
   *reason two tributes talk*. "We both cannot stand Careers" is the most natural
   alliance premise in the genre and the data for it is already on the table.
3. **The charter should be able to be re-negotiated, not only hardened.** The
   hardening path exists (`"The terms get harsher around the fire that night"`).
   Softening — dropping a rule because keeping it is killing the group — is the
   same code path with the sign flipped and it says something the game currently
   cannot.
4. **Grief should have a target.** `GRIEF_TEXTS` is the deepest pool in the game
   (55 lines, 4.1x its draw rate) and `griefResist` is carried by 6 traits.
   `fortifiedBond` — "shared grief bonds two survivors" — is written and dead
   (§1.5). Two people who lost the same person should be measurably closer.

---

## §5 — Arena: updates, robustness and more complexity

### 5.1 Five arenas are not finished, and this is the arena section's headline

Restated from §1.1 in arena-design terms.

`tidewrack`, `thresher`, `vigil`, `saltworks` and `kiln` are simultaneously:

- the **only five** hand-authored arenas with no signature rule of any kind
- the **only five** with no `SIGNATURE_BLURBS` entry
- **five of the five** packs sitting exactly on the flavour hard floor of 24
  events (every other pack is above it; the roster's next-thinnest are at 33)
- each carrying **4 once-per-run events and 1 chain**, the minimum the checker
  accepts

They are not broken — they play to completion, they enforce their stacked laws
(`test:arenas` proves `noForage+tidalBorders` in tidewrack, `bloodPrice+openMic`
in thresher, `dawnMercy+noRest` in vigil, `meltingGround+noWaterExceptZone` in
saltworks, `bountifulGround+twinSuns` in kiln), and their laws are five of the
best in the set. They are *unfinished*, uniformly, in exactly the three places a
roster check does not look.

The five new laws are genuinely good and are doing the work a signature would
otherwise do, which is probably why nobody noticed. But a law is a standing
condition and a signature is an *event* — the arena taking a swing — and these
five arenas never take one.

### 5.2 The roster, measured

- **45 hand-authored arenas**, 6–13 zones each (mean ~10.5), 415 zones total,
  every one authoring an interior.
- **12 procedural biomes**, rolling 8–16 zones; `procedural-tundra` at 14,
  `procedural-archipelago` and `procedural-ruinlands` at 16 are the largest bands.
- **52 mutt rosters, 216 mutts**, every id and name unique, every terrain in
  every arena covered by at least one mutt.
- **1,522 authored arena events** across 49 packs plus the universal pool.
- **20 arena laws**, 21 distinct law-instances across the roster.
- **103 edge rules**: tolled 28, contested 25, hidden 15, collapsing 13,
  timeGated 9, oneWayAfter 8, oneWay 5.
- **165 arena layouts** validated, no label collisions, 46px touch targets.

### 5.3 The `requires` vocabulary is now used, and the shape of the usage is lopsided

`AUDIT-4 §5.3` said the vocabulary was "built and barely used". It is now on
**229 of 1,522 events (15.0%)**. Sub-key usage:

| key | events |
|---|---|
| `time` | 82 |
| `law` | 31 |
| `storm` | 24 |
| `elevationOrChoke` | 21 |
| `trait` | 20 |
| `maxSurvivors` | 17 |
| `effect` | 17 |
| `stance` | 16 |
| `sanityBand` | 13 |
| `minSurvivors` | 10 |
| `loadBearing` | 6 |

**Only 23 events combine two keys and none combines three.** The combination
table is: `elevationOrChoke+storm` 4, `maxSurvivors+time` 3,
`elevationOrChoke+time` 2, `law+time` 2, `maxSurvivors+sanityBand` 2,
`stance+time` 2, `minSurvivors+trait` 2, and six singletons.

That is the whole of the compound vocabulary: 23 events out of 1,522. The
grammar's value is precisely in compounds — "at night, in a storm, on high
ground, when the field is down to six" is a specific enough moment to be worth
writing a bespoke line for, and it is exactly the kind of moment that makes an
arena feel like it noticed you. The single-key uses are mostly day/night gating,
which is a filter rather than a dramatic condition.

### 5.4 The laws are in good shape and the additive ones are still the rarest

Twenty laws now, against `AUDIT-4 §5.4`'s sixteen. Measured instances across the
roster:

| law | instances | direction |
|---|---|---|
| `noWaterExceptZone` | 30 | takes away |
| `noSponsors` | 23 | takes away |
| `fireImpossible` | 22 | takes away |
| `openMic` | 18 | redirects |
| `noHealing` | 18 | takes away |
| `noForage` | 17 | takes away |
| `oneWayBorders` | 15 | redirects |
| `deadlyNight` | 14 | takes away |
| `sponsorsFixedZone` | 13 | redirects |
| **`bountifulGround`** | **9** | **gives** |
| `noWeapons` | 8 | takes away |
| **`dawnMercy`** | **8** | **gives** |
| `shrinkingArena` | 8 | compresses |
| `noCannons` | 8 | takes away |
| `cornucopiaRefills` | 5 | gives |
| `tidalBorders` | 4 | redirects |
| `bloodPrice` | 4 | gates |
| `noRest` | 4 | takes away |
| `meltingGround` | 4 | takes away |
| `twinSuns` | 4 | takes away |

Thirteen of twenty subtract. The three that give (`bountifulGround`, `dawnMercy`,
`cornucopiaRefills`) total **22 instances**, which is fewer than `noSponsors`
alone. The 2023-era argument in `types.ts:1681` for why an additive law changes
what players do rather than what they cannot do is correct and the roster still
does not act on it.

**Two additive laws worth writing**, both enforceable at one site the way the
existing twenty are:

- **`salvage`** — every corpse leaves a usable cache where it fell, for one
  cycle. Turns the map into a moving set of contested points and gives
  `Vulture` (the highest-win earned trait) a reason to exist that is not
  survivorship.
- **`theBell`** — once a day, the Gamemakers name a zone and whoever is standing
  in it at nightfall is resupplied. A scheduled, announced, contested gift. This
  is `sponsorsFixedZone` inverted from a restriction into an invitation.

### 5.5 The arena talks almost exclusively to agility and intelligence

Of the 1,241 events that set a `dodgeStat`:

| stat | events | share |
|---|---|---|
| intelligence | 431 | 34.7% |
| agility | 421 | 33.9% |
| stealth | 138 | 11.1% |
| willpower | 124 | 10.0% |
| endurance | 78 | 6.3% |
| strength | 45 | 3.6% |
| **charisma** | **4** | **0.3%** |

Agility + intelligence is **68.6%** of every roll the arena asks a tribute to
make. `dodgeAlt` — the second way out, rolled at a penalty — is set on only
**437 events (28.7%)**, and `encounters.ts` falls back to strength automatically
for the rest, which is the only reason strength matters at all.

The consequence is a balance one and belongs partly in §8: an arena hazard is,
in practice, a tax on two of six attributes. A tribute built for endurance or
charisma is not merely worse at the arena — the arena does not ask them
anything. Redistributing 150–200 of the existing `dodgeStat` assignments, and
filling in `dodgeAlt` on the 71% that lack it, costs no new content.

### 5.6 The edge-rule layer is healthy now

`AUDIT-4 §1.1` found `contested` on one edge in one arena out of forty with sixty
lines of garrison engine that fired zero times in 160 runs. Measured now:
**103 edge rules across the roster — tolled 28, contested 25, hidden 15,
collapsing 13, timeGated 9, oneWayAfter 8, oneWay 5.** Every one of the seven
kinds is on double digits or close. **This finding is closed.**

The remaining observation is that `isSevered` — the predicate for "this edge is
cut right now" — is dead code (§1.5), while `severedEdges` is written by
`tidalBorders`, by `severesRoute` on 38 events, and by the `severEdges` signature
payload. Every read site inlines the check. Not a bug; a consolidation.

### 5.7 The five signatures that should be written

Each arena's premise already names its rule. These are the obvious ones, and each
is expressible in the existing `trigger × selector × payload × telegraph`
grammar, so none needs bespoke code:

| arena | law | proposed signature |
|---|---|---|
| **Tidewrack Flats** | `noForage`+`tidalBorders` | **The turn of the tide.** Every night, `severEdges` on the lowest-lying zones, telegraphed one cycle ahead by the water withdrawing. The law already re-cuts the map; the signature should be the *moment* it does, visible and dreadable. |
| **Thresher Floor** | `bloodPrice`+`openMic` | **The line starts.** `everyNth`, `busiestZone`, `damageEffect` — the machinery starts up under whoever is standing on it, without warning. `openMic` means the whole arena hears it happen to somebody else. |
| **The Vigil** | `dawnMercy`+`noRest` | **The watch changes.** `nightsOnly`, `allZones`, `drainVital` on fatigue, telegraphed. A place where nobody sleeps should have a rule about the hour nobody can stay awake through. |
| **The Saltworks** | `meltingGround`+`noWaterExceptZone` | **The pan cracks.** `afterEscalation`, `emptiestZone`, `spawnMutt` — the ground a tribute fled to is where the thing under it comes up. `meltingGround` already punishes lingering; this punishes hiding. |
| **The Kiln** | `bountifulGround`+`twinSuns` | **The second sun.** `daysOnly`, `lowestDanger`, `invertResources`, telegraphed — the zone that looked safest this morning is the one that bakes this afternoon. The only arena whose law *gives*, and the only signature that should take the gift back. |

---

## §6 — Small and side features: updates, robustness and complexity

### 6.1 Quirks: the finding from the last audit is fully closed

`AUDIT-4 §6.3` called quirks "340 lines of flavour with no mechanics". Measured
now: **85 quirks, 85 `QUIRK_MODS` rows, 41 distinct `TraitMod` keys used**.
Examples from the table: `'eats in exact halves'` → `hungerDrain: -1.5`;
`'sleeps sitting up'` → `fatigueNight: +1.5, awarenessNight: +0.5`;
`'names the mutts'` → `fearGain: -0.1, muttDamage: -0.05`.

Distribution over 200 runs is flat and healthy — 6,494 quirk-instances, most
frequent 103, least frequent 58, a 1.8x spread across 85 entries. `describeQuirk`
renders the mods into readable phrases through `MOD_PHRASES`, so the mechanical
effect is surfaced rather than hidden. **This is the model the rest of the flavour
layer should follow.**

### 6.2 Quells: 28 authored, 7.3% of runs, so two thirds are effectively unseen

Measured over 300 runs: **22 runs drew a Quell (7.3%)**, and those 22 runs drew
**15 distinct Quells** of 28 authored. Top of the distribution is two occurrences
(`long-games`, `lean-quell`, `thirst-quell`, `bounty-quell`, `no-alliances`,
`blood-debt`, `the-reflection`); everything else is a singleton.

`AUDIT-4 §6.2` reported 6%; the rate has moved a little and the structural issue
has not. At 7.3%, a player sees a Quell roughly once in fourteen runs and a
*specific* Quell once in about four hundred. Twenty-eight authored Quells is a
lot of content behind a door that opens that rarely.

`reflection-survivor` is on the never-unlocked list for exactly this reason: it
needs `quell.id === 'the-reflection'` **and** a victor, which is one Quell in
twenty-eight, in 7.3% of runs. That is roughly 1 run in 380, and the check runs
500. It is correctly labelled `possible` and should probably stay that way — but
it demonstrates the cost.

**Two options, and they are different games.** Raise the Quell rate to ~15% and
accept Quells as a normal texture; or keep the rate and make the Quell *matter
more* when it lands — a Quell year could be the one that unlocks a Hall-of-Fame
category, so the rarity is a reward rather than an absence.

### 6.3 Wildcards and the calendar: 27 kinds, all live

27 `WILDCARDS` definitions, plus the Quell-injected standing wildcards.
Calendar disruption lines fire **2.63 times per run in 94.7% of runs**, and
`extraWildcardsFired` correctly caps at `WILDCARD.maxExtraDisruptions` with
diminishing odds and enforced spacing. `AUDIT-4 §6.1`'s verdict ("all reachable,
all consumed") holds.

### 6.4 The replay-hook layer is thinner than it looks

`data/replayHooks.ts` is 134 lines and carries **6 mutators**: `famine`,
`knives-out`, `patrons-year`, `the-grinder`, `clear-heads`, `two-hander`. It also
carries `dailySeed`, `dailyArenaId`, `dailyConfig` and `featuredArena` — a
complete daily-challenge scaffold.

Six mutators against 9 temperaments, 8 cast shapes, 28 Quells and 27 wildcards
is the thinnest axis in the replayability stack, and it is the only one the
player selects deliberately rather than receiving. §9.5 treats that as the
replayability problem it is.

### 6.5 The flavour-pool checker does not see every flavour pool

`data/flavorText.ts` exports **51** `const` pools. `check-flavor-pools.ts`
reports on "21 flavour pools" and "147 nested pools" and does not include
`LEGENDARY_ITEM_TEXTS`, which is why a twelve-line authored pool has been dead
since it was written (§1.4).

The checker should enumerate the module's exports rather than a maintained list,
and should fail on any `*_TEXTS`/`*_NAMES`/`*_LINES` export with zero references
outside its own file. That is the guard that turns §1.4 from a thing an audit
finds into a thing CI finds.

### 6.6 The other side features, briefly

| feature | state | measured |
|---|---|---|
| Gamemaker levers | good, opt-in only | 19.8 lines/run, 100% of runs (in gamemaker mode) |
| Sponsors / parachutes | healthy | 18.3 lines/run, 95.0% of runs |
| Side markets / odds | healthy | 8.5 lines/run, 100% of runs |
| Feast | healthy | 5.5 lines/run, 92.3% of runs |
| Shelter (`fieldcraft`) | healthy | 9.0 lines/run, 100% of runs |
| Camouflage | healthy | 4.1 lines/run, 78.3% of runs |
| Weapon sharpening | healthy | 4.1 lines/run, 93.0% of runs |
| Mentors | healthy | 4.7 lines/run, 99.3% of runs |
| Abandoned camps | healthy | state non-empty in 56.8% of runs |
| Watch rotation | **thin** | 0.50 lines/run, 32.3% of runs |
| Verticality | **thin** | 0.05 lines/run, **2.7% of runs** |
| Zone control (holding the horn) | **thin** | 0.10 lines/run, **9.7% of runs** |
| Rumour planting | **thin** | 0.42 lines/run, 31.7% of runs |
| Rumour debunking | **near-dead** | 0.01 lines/run, **1.3% of runs** |

**Verticality is the standout.** `engine/verticality.ts` exports `isVertical`,
`levelOf` and `othersHere`, all file-internal, and the feature surfaces in the
log in under 3% of runs. Meanwhile `elevationOrChoke` is a `requires` key on 21
events and `zoneSightlines` gates on `zoneFeatures().elevation`. The arena knows
about up and down; the tribute almost never does.

**Zone control is the second.** `controllingAlliance` is dead code (§1.5),
`cornucopiaHolder`/`cornucopiaHeldSince`/`cornucopiaPaidAt` are all written and
maintained by `tickZoneControl`, and the fact that somebody is *holding the horn*
surfaces in one run in ten. Holding the Cornucopia is the most legible strategic
position in the genre.

---

## §7 — More ways to die, and more events

### 7.1 Where deaths come from now, measured

300 runs, 6,912 deaths, 3,407 distinct `causeOfDeath` strings, **642 of them
non-tribute**, covering 2,857 deaths (41.3% of all deaths).

Collapsed to templates — 102 distinct — the top of the distribution is:

| template | deaths | share of all deaths |
|---|---|---|
| `Died of …` (dehydration 351, starvation 51, exhaustion, exposure, sepsis) | 651 | 9.42% |
| `Succumbed to …` (poison 325, infected wound 195) | 520 | 7.52% |
| `Bled out from …` | 366 | 5.30% |
| `Torn apart by …` (mutts) | 264 | 3.82% |
| `Froze to …` | 196 | 2.84% |
| `Caught in …` (fire, flood, machinery, front) | 176 | 2.55% |
| `Collapsed from …` | 139 | 2.01% |
| `Buried in …` | 99 | 1.43% |
| `Driven into the force field …` | 70 | 1.01% |
| `Fell inside …` | 60 | 0.87% |
| everything else (92 templates) | 316 | 4.57% |

At n=1,600 the guarded splits are: **deaths caused by another tribute 59.4%**
(goal ≥40%, met), **mutts and hazards 14.3%** (goal ≥7%, met), **untreated
bleeding 5.9%** (goal ≤10%, met). The distribution is in the shape the design
wants and `AUDIT-4 §7.1`'s concerns are addressed.

### 7.2 The long tail is 92 templates carrying 4.57% of deaths, and that is the interesting number

Ninety-two of the 102 death templates together account for under a twentieth of
all deaths. Sixty-eight of them fire **once** in 6,912 deaths. The `Crushed as X
closed` family alone is **41 distinct templates** — one per zone name — totalling
about 100 deaths, because the border-collapse line interpolates the zone.

That is not a bug; it is how a templated cause string works. But it means the
*variety* in the death table is mostly variety of proper noun, not variety of
death. Genuinely distinct once-seen causes in the tail include
`'Walked off a bearing that no longer existed'`,
`'Was the moral of …'`, `'Eaten alive on the flats'`,
`'Suffocated when the scrubbers failed'`, `'Froze when the generator failed'`,
`'Drowned when the reservoir broke'`, `'Taken under the ice'`,
`'Killed at the well'`, `'Struck down for defying the Gamemakers'' Quell'`.
These are the good ones and there are about a dozen.

### 7.3 Universal deaths the model has state for and does not use

Each of these reads a field the engine already writes, so none needs new state:

1. **Died of thirst while carrying water.** `items.ts` tracks a `water` item kind
   and `condition`; `survival.ts` tracks `thirst`. A tribute who dies of
   dehydration holding a fouled canteen is a death the model can already
   describe and never does.
2. **Killed by their own trap.** `fieldcraft.ts` has `setTrap` with five trap
   kinds, and traps are set 0.59 times per run. Nothing lets a trap kill its
   setter — a tribute doubling back in the dark onto their own deadfall.
3. **Died of a wound they were treating.** `medicine` proficiency is the lowest
   in the game (1.07, §3.3) and `infection.ts` has `worstSepsis` as a
   file-internal export. A botched field surgery is the natural death for a low
   proficiency that currently just means "slower to heal".
4. **Fell from a level.** `verticality.ts` models levels and fires in 2.7% of
   runs (§6.6). `Dropped a level when the ground gave way in …` exists at 7
   occurrences in 6,912 deaths. Falls between levels should be one of the
   commonest arena deaths and are among the rarest.
5. **Died of sleep deprivation.** `sleepDeprivation` and `sleepDropChance` in
   `survival.ts` are both file-internal. `noRest` and `deadlyNight` are laws
   built around sleep. `Died of exhaustion` exists but is driven by `fatigue`
   rather than by nights without sleep.
6. **Killed by the crowd's disappointment.** `audience.ts`, `exposure.ts` and
   `notoriety.ts` all track how interesting a tribute is. `openMic` and the
   Gamemaker levers are the Capitol's hand. A tribute the audience has stopped
   watching being *removed* is thematically the centre of the genre and the game
   has every input for it.
7. **Died holding a named weapon.** `legendName` exists, weapons are named in
   91.3% of runs, and nothing marks the death of the person who named one.

### 7.4 Arena-specific deaths worth adding

The five unfinished arenas (§5.1) are also the five with the thinnest death
vocabularies, since each pack sits at the 24-event floor. Each has an obvious
signature death sitting in its law:

| arena | law | death |
|---|---|---|
| Tidewrack Flats | `tidalBorders` | **Stranded by the tide** — cut off on a bar as the edges sever, and drowned there. |
| Thresher Floor | `bloodPrice` | **Turned away at the horn** — starved within sight of a Cornucopia that will not open for somebody who has not killed. |
| The Vigil | `noRest` | **Did not wake for the watch** — the only arena where sleep restores nothing should have a death that is simply not getting up. |
| The Saltworks | `meltingGround` | **Went through the pan** — the ground a tribute has already depleted giving way under them on the way back. |
| The Kiln | `twinSuns` | **Found no shade** — heat death in an arena that has no shade anywhere by law, which currently kills only through the generic heatstroke line. |

Beyond those five: `openMic` (18 arena-instances) has no death of its own, and
"killed because the whole arena heard the fight and converged" is the death that
law exists to enable.

### 7.5 More events, universal

The universal pool is the one every arena draws on and it is where a new event
buys the most. Five shapes the schema supports and the content barely uses:

1. **Events that make you hungry.** `hunger` is set on **13 of 1,522 events
   (0.9%)** against `thirst` 71 and `fatigue` 348. Vomiting up what you foraged,
   a cache spoiled, a night too cold to keep food down.
2. **Events with a positive outcome.** 257 of 1,522 events (16.9%) set `heal`,
   `quench`, `feed` or `grantItem`. Five in six arena events are a punishment,
   which makes the arena a uniform tax rather than a place with weather.
3. **Events that use `witnesses`.** Set on 182 events (12.0%). An event that
   names everybody who saw it is the cheapest way to turn a hazard into a social
   fact, and it is used on one event in eight.
4. **Events that compound their conditions.** 23 of 1,522 events combine two
   `requires` keys and **none combines three** (§5.3). A storm, at night, on high
   ground, with six left is a moment worth writing for.
5. **Events that roll against charisma, endurance or strength.** 127 of 1,241
   events between them (§5.5). An arena event a tribute talks their way out of
   is a shape the schema fully supports and four events use.

### 7.6 More events, arena-specific

The blunt number: **45 of 49 packs are below the soft target of 40 events, and
the roster is 357 events short of every pack reaching it.** Five packs are on the
floor of 24. The generic fallback carries 30, which means a 24-event pack is
*thinner than the generic pool it exists to displace*.

The priority order is the flavour checker's own: the five floor packs first
(`tidewrack`, `thresher`, `vigil`, `saltworks`, `kiln` — 16 each to reach 40),
then the 33-event packs (`cabin`, `magmatube`, `karst` and the rest).

The per-pack shape targets are worth stating too, because "more events" without
them just deepens the same distribution: each pack should reach **4+ once-per-run
events** (the five floor packs have exactly 4) and **2+ chains** (they have 1).
`chain` is set on **46 of 1,522 events (3.0%)** roster-wide, and a chained event
— this happens, and next cycle *that* happens to the same person — is the closest
the arena layer gets to telling a story.

---

## §8 — Trait and archetype balance audit

### 8.1 The headline: archetype balance is close and one archetype is the whole gap

At **n=1,600**, every archetype clears the 500-entrant threshold, so the
whole-field verdict stands rather than being suppressed:

- **spread (best/worst): 2.94x** against a goal of ≤2.3x — **short**
- **best: `career` 9.98%** against a goal of ≤8% — **short**
- **worst: `scholar` 3.40%** against a goal of ≥3.5% — **short by 0.10pp**

This is a substantial improvement on `AUDIT-4` (4.56x at the unjudgeable sample;
the guard was 4.6x). But the more useful reading is what happens when Career is
set aside:

| | win rate | spread |
|---|---|---|
| all fifteen | 9.98% – 3.40% | **2.94x** |
| **excluding `career`** | 5.34% – 3.40% | **1.57x** |

**The fourteen non-Career archetypes are already inside the design goal.** The
entire miss is one archetype, and the goal of ≤8% for the best is a goal about
Career specifically.

### 8.2 The full table at n=1,600

| archetype | n | win% | avg days | avg kills | `targetDraw` |
|---|---|---|---|---|---|
| career | 3,497 | **9.98%** | 4.55 | 1.13 | 5 |
| survivalist | 3,016 | 5.34% | 3.93 | 0.46 | −0.5 |
| strategist | 2,886 | 4.92% | 3.65 | 0.52 | — |
| trickster | 2,755 | 4.86% | 3.33 | 0.64 | — |
| beast | 802 | 4.86% | 2.99 | 0.73 | 2.5 |
| wildcard | 2,549 | 4.83% | 2.97 | 0.63 | — |
| diplomat | 1,050 | 4.67% | 3.96 | 0.54 | −0.5 |
| ghost | 1,312 | 4.57% | 4.11 | 0.42 | −2.5 |
| protector | 3,415 | 4.57% | 3.73 | 0.54 | 1 |
| mercenary | 1,335 | 4.49% | 3.00 | 0.56 | 1.5 |
| medic | 1,049 | 4.10% | 4.05 | 0.46 | −1 |
| underdog | 3,313 | 3.71% | 3.66 | 0.40 | −1.5 |
| zealot | 1,085 | 3.69% | 2.86 | 0.69 | 1 |
| saboteur | 1,100 | 3.64% | 3.40 | 0.38 | — |
| **scholar** | 1,296 | **3.40%** | 3.66 | 0.42 | −1.5 |

Career is dominant on **all three axes simultaneously**: best win rate, longest
survival (4.55 days against a field mean of 3.56), most kills (1.13 against
0.55). `targetDraw: 5` — the highest in the table, and the lever
`AUDIT-4 §8.3` introduced precisely to give Career a weakness — is in place and
has not been enough. Career victors at n=1,600 are **53.7%** of all victories
against a goal of ≤45%.

`scholar` at the bottom is the one with no `targetDraw` advantage to speak of
(−1.5, same as underdog), the second-lowest kills, and a middling day count. It
is the archetype with nothing it is best at.

**The lever that has not been pulled:** `preferredTraits` is **2 or 3 entries on
every archetype** out of 53 rollable traits. A scholar who reliably reaps
`Eagle-Eyed` + `Strategist` + `Herbalist` + `Cool-Headed` is a different tribute
from one who reaps two of them; Career already effectively gets this through
district weighting. Widening `preferredTraits` to 4–5 on the bottom five
archetypes is the cheapest correction available and it does not touch a single
combat number.

### 8.3 Archetype columns that are still sparse

| column | filled |
|---|---|
| `targetDraw` | **11 / 15** |
| `hatesArchetypes` | **9 / 15** |
| `targetPreference` | 15 / 15, but only **5 distinct values**, and `weakest` is used by 6 |
| `stanceBias` | 15 / 15, 2–4 entries each |
| `objectiveBias` | 15 / 15, 1–3 entries each |
| `preferredTraits` | 15 / 15, **2–3 entries each** |
| `riskCurve` | 15 / 15 |

`targetDraw` is unset on `strategist`, `trickster`, `wildcard` and `saboteur` —
and those four are clustered at 4.92%, 4.86%, 4.83% and 3.64%, so it is not
obviously costing them. It is still the most interesting column in the table and
four archetypes have no reading of it.

`hatesArchetypes` at 9/15 is the one worth filling, because it is the only column
that makes archetypes interact with *each other* rather than with the arena, and
§4.4 proposes turning it into an alliance premise as well as a targeting one.

### 8.4 Archetype signature fire rates have a 1.57x spread

| archetype | signature fires | n |
|---|---|---|
| survivalist | 56.9% | 3,016 |
| scholar | 55.6% | 1,296 |
| underdog | 54.5% | 3,313 |
| career | 54.1% | 3,497 |
| strategist | 53.7% | 2,886 |
| diplomat | 53.0% | 1,050 |
| protector | 51.3% | 3,415 |
| trickster | 47.5% | 2,755 |
| medic | 45.6% | 1,049 |
| saboteur | 45.1% | 1,100 |
| beast | 42.9% | 802 |
| ghost | 41.3% | 1,312 |
| wildcard | 41.0% | 2,549 |
| zealot | 38.3% | 1,085 |
| **mercenary** | **36.2%** | 1,335 |

Every archetype's once-per-run set piece fires for at least a third of its
entrants, so none is theoretical. The spread (56.9% vs 36.2%) is tight enough
not to be a balance problem, but it is worth noting that the three lowest
(`wildcard`, `zealot`, `mercenary`) are all archetypes whose signature needs
another tribute to be present, and the three highest are all self-contained.

### 8.5 Reaping traits: 2.37x spread, and three signs look wrong

At n=1,600 the reaping-assigned set (the only population that can be balanced
against itself, since earned traits are survivorship) spans
**Brute 8.49% → Fragile 3.58%, a 2.37x spread**, against a goal of ≤2.5x —
**met**, and down from 4.31x.

The field mean is roughly 5.0%. The top and bottom are correctly signed: `Brute`,
`Butcher`, `Wrestler` at the top are combat traits; `Fragile` at the bottom is an
explicit drawback. But three pairs invert:

| trait | win% | its opposite | win% |
|---|---|---|---|
| `Clumsy` | **5.09%** | `Nimble` | **4.11%** |
| `Skittish` | **6.04%** | `Cool-Headed` | **4.85%** |
| `Needy` | **6.18%** | `Steadfast` | 6.61% |

`Clumsy` beating `Nimble` and `Skittish` beating `Cool-Headed` are the two that
want explaining. The metrics report's own note is the likely cause and is worth
quoting: *"archetype `preferredTraits` skew every other large sample here. A
trait far off the field mean with a large n is as likely to be measuring who
receives it as what it does."* `Nimble` (n=2,628) and `Clumsy` (n=1,218) have
very different n, which is the signature of `preferredTraits` assignment rather
than of trait power.

**This is a measurement gap, not necessarily a balance bug**, and the honest
thing to say is that the current instrument cannot distinguish them. The fix is
an instrument one: partition the reaping-trait table by archetype, so
"Nimble tributes" is compared against "non-Nimble tributes *of the same
archetype*". That is a change to `scripts/metrics.ts`, not to the game.

Two more observations that are not measurement artefacts:

- **`Hydrophilic` at 6.65% (n=1,383) is the highest-winning non-combat trait**,
  and it carries **2 mods**. `water` and one other. That is a lot of win rate for
  a very thin row.
- **`Trapper` at 3.69% (n=3,007)** is third-from-bottom despite being issued to
  District 3 at the reaping *and* being an archetype preference. Traps fire 0.59
  times per run and spring on a tribute in 2.3% of runs (§6.6), so the trait is
  measuring a mechanic that barely runs.

### 8.6 Trait power is unevenly distributed across the mod vocabulary

70 traits (53 rollable, 17 earned) against 51 `TraitMod` keys. Mod-row sizes run
from 1 to 6:

- **Thinnest (1–2 mods, 19 traits):** `Light Sleeper` (1), `Hydrophilic`,
  `Iron Stomach`, `Insomniac`, `Venom-Blooded`, `Sun-Hardened`, `Fire-Shy`,
  `Cool-Headed`, `Swimmer`, `Night-Sighted`, `Marksman`, `Butcher`,
  `Treacherous`, `Showman`, `Trapper`, `Scavenger`, `Hoarder`, `Venom-Wise`,
  `Trapwise`.
- **Fattest (5–6 mods):** `Hardened` (6), `Steadfast`, `Prickly`,
  `Diplomatic Cover`, `Sworn`, `Unremarkable`, `Broken`, `Hollow` (5 each).

Mod-key usage is just as uneven. Of 51 keys:

- **`allianceAffinity` is carried by 22 traits**, `retreat` by 16,
  `resolveDrift` by 13, `treachery` by 10, `sponsorTrust` by 9, `sanityDrain` by 9.
- **Nine keys are carried by exactly one trait**: `thirstDrain`,
  `awarenessNight`, `coldResist`, `highland`, `wrestle`, `burnOnHit`,
  `vengeanceEdge`, `sponsorAppeal`, `muttDamage`.

A key carried by one trait is a hook whose entire behavioural meaning is that
one trait's row, which is fine for `burnOnHit` (Pyromaniac) and odd for
`coldResist` — an arena set has four ice arenas and one trait resists cold.

### 8.7 Earned traits and the survivorship warning

The metrics report correctly partitions earned traits and correctly warns that
their win rates are survivorship rather than power — you cannot earn `Vulture`
without surviving long enough to loot four corpses. The holder rates over 400
runs are:

`Vulture` 57.6% win rate (n=106), `Feared` 33.2% (545), `Hollow` 27.8% (374),
`Broken` 22.8% (101), `Merciful` 22.3% (121), `Silent Step` 19.8% (373),
`Firetouched` 18.7% (342), `Waterborn` 17.9% (123), `Bloodied` 15.2% (2,306),
`Starved` 13.4% (993), `Oathbound` 12.4% (178), `Star-Crossed` 12.1% (174),
`Marked` 7.4% (447), `Haunted` 6.5% (1,337), `Venom-Wise` 3.3% (122).

**761 traits were shed or transformed across 400 runs** (~1.9/run), so the trait
arc system is live. `shedTrait` in `traitArcs.ts` is exported and file-internal;
not a bug.

`Venom-Wise` at 3.3% (n=122) is the earned trait that is below the field mean,
which is the one reading here that is not explained by survivorship — every other
earned trait is at or above 6.5%. It is also a 2-mod trait (§8.6). Worth a look.

---

## §9 — Replayability, and keeping the game from going stale

### 9.1 What already fights staleness, measured

The axes that vary between two runs on different seeds:

| axis | options | measured rate |
|---|---|---|
| arenas (hand-authored) | 45 | selected or random |
| arenas (procedural biomes) | 12, each rolling its own layout and signature rule | — |
| arena laws | 20, stackable | 21 instances across the roster |
| Games temperaments | 9 | every run |
| cast shapes | 8 | every run |
| Quells | 28 | **7.3% of runs** |
| calendar wildcards | 27 | 2.63 lines/run, 94.7% of runs |
| mutators (player-selected) | **6** | opt-in |
| traits | 53 rollable + 17 earned | every run |
| archetypes | 15 | every run |
| quirks | 85, all mechanical | every run |
| mutts | 216 across 52 rosters | 87 distinct seen in 300 runs |
| arena events | 1,522 | 3.5+/run of the arena's own pack |
| epithets | 135 distinct seen in 200 runs | 2.17 holders/run |
| names | 3,200 across 16 districts | every run |
| run length spread | sd **2.15 days** (goal ≥2.0, met) | — |
| districts winning ≥4% | **11 of 12** (goal ≥8, met) | — |

That is a lot of variation, and two of the hardest indicators — run-length
spread and district diversity — now meet their design goals, which they did not
at the last audit. **The first ten runs of this game are genuinely different from
each other.**

### 9.2 The tail is still unreachable, and the reason is per-run reach

A tribute sees **3.5+ events of their arena's pack per Games** (the `test:sim`
guard; measured range across four arenas at 120 runs each is 3.7–8.0 of 33). The
thinnest packs carry 24. So reaching the whole of one arena's authored content
takes somewhere between four and ten runs *in that one arena*, and the roster has
45 of them.

The same shape applies everywhere:

- **Quells**: 15 distinct seen in 300 runs; reaching all 28 would take roughly a
  thousand runs.
- **Mutts**: **87 distinct named in 300 runs, of 216 authored (40.3%)**.
  `terrainPreference` is a hard filter on 68% of mutts and `ARENA_MUTTS` is
  per-arena, so a mutt is gated behind both its arena and its terrain.
- **Achievements**: 114 of 193 land in the usable 5–60% band; 11 never unlock;
  7 fire on 60%+ of runs.

A player who plays fifty runs sees a great deal of variety and still has not seen
half the mutts or half the Quells. That is a good problem to have and it means
the content budget should go to **depth in the arenas that get played** rather
than to breadth.

### 9.3 The five unfinished arenas cost more here than anywhere else

Restated from §5.1 in replayability terms.

An arena's signature is the thing a player learns. "In the Silk Wood, this
happens" is the sentence that makes a second run in the Silk Wood different from
a first — you know what is coming and you play around it. `tidewrack`,
`thresher`, `vigil`, `saltworks` and `kiln` have no such sentence, so a second run
in them is a first run with different rolls.

They also carry the thinnest event packs (24, at the floor) and the fewest
once-per-run events (4) and chains (1). Per-run reach of 3.5+ against a 24-event
pack means the third run in The Kiln is drawing lines the player has already
seen, with no signature to reframe them.

**These five arenas are the ones that go stale fastest, and they are the newest.**

### 9.4 What run N does to run N+1

The continuity layer exists and is thin:

- **Hall of Fame** archives every victory with name, district, kills, traits and
  end health, and `veterans.ts` can graft up to two archived victors back onto a
  reaped field. Measured: the "has been here before" family of lines fires in
  **1.8% of runs**, which is right for a Grudge Match feature but means the
  layer is essentially invisible in normal play.
- **`panemStorage`** tracks record holders, district crowns, Gamemaker records
  and `deathsSeen` across runs.
- **Arena unlocking** — `SetupScreen` collapses locked arenas into one line
  offering the two ways to reach them, which is the right call.
- **`continuity.ts`** exports `districtStanding` and `ContinuityRecords`, both
  file-internal.

What is missing is **consequence**. A district that has won three years running
should be reaped differently; a district that has not won in twenty should get
something for it. `DistrictLegacy` and `DistrictCraft` exist in `districts.ts`
and drive a *static* tier — measured at n=1,600: storied 8.8%, strong 8.7%,
modest 3.8%, forgotten 3.5%, thin 3.3%. That 2.7x tier spread is a design choice
and it is fixed at the reaping. Nothing the player does moves it.

### 9.5 The axes worth opening

1. **Mutators are the thinnest axis and the only one the player chooses.** Six,
   against 9 temperaments, 8 cast shapes, 28 Quells and 27 wildcards. They are
   also the only lever that lets a player deliberately ask for a *kind* of
   Games. Doubling them to twelve is the single highest-leverage replayability
   change available, and `applyMutator`/`mutatorActive` already make them
   composable.
2. **A daily challenge exists in code and is not surfaced.** `dailySeed`,
   `dailyArenaId`, `dailyConfig` and `featuredArena` are all written in
   `replayHooks.ts`. `featuredArena` even takes a `seenNames` list so it can
   prefer an arena this player has never run. This is a complete feature waiting
   on an entry point.
3. **Make district standing move.** §9.4 — the one meta-progression that would
   make run 20 feel different from run 2.
4. **Raise the Quell rate or raise the Quell payoff.** §6.2.
5. **Finish the five arenas.** §5.7 and §9.3.

---

## §10 — Shallow and incomplete mechanics; names and other flavour

### 10.1 Mechanics that are shallower than their code suggests

Measured by log visibility over 300 runs, cross-checked against the state each
system writes:

| mechanic | lines of engine | surfaces in | verdict |
|---|---|---|---|
| **Verticality** | `verticality.ts`, 3 exports | **2.7% of runs** | shallowest in the game |
| **Rumour debunking** | `rumours.ts:313` | **1.3% of runs** | written, essentially unreachable |
| **Zone control** | `zoneControl.ts` + 3 state fields | **9.7% of runs** | the most legible strategy in the genre, nearly invisible |
| **Bloc treaties** | `blocTreaty.ts`, 239 lines | agreed 38.8%, resolved ~9% | forms, never ends on screen |
| **Rumour planting** | `rumours.ts:185`, 60 lines | 31.7% of runs | the interesting half of a working system |
| **Watch rotation** | `watch.ts` | 32.3% of runs | thin for something every camp does |
| **Traps** | `fieldcraft.ts`, 5 kinds | set 40.3%, **sprung 2.3%** | the setting is 17x the springing |
| **Handedness** | `types.ts:344` + `updateFavouring` | — | declared, asymmetric, unread |
| **Memory unreliability** | `memory.ts`, 3 exports | — | file-internal |
| **Sleep deprivation** | `survival.ts`, 2 exports | — | file-internal |
| **Zone acoustics** | `map.ts:316`, all 415 zones author it | — | **dead** |
| **Near-misses, in-run** | `achievements.ts:3024`, 122 predicates | — | **dead** |
| **Legendary item flavour** | `flavorText.ts:3492`, 12 lines | — | **dead** |
| **Procedural signature blurb** | `arenaSignature.ts:1911` | — | **dead** |

The pattern is consistent enough to name: **this codebase's characteristic
failure is not broken code, it is completed code with no consumer.** Seventeen
dead exports (§1.5), four of them whole features. Every one of them passes lint,
passes every check in the roster, and does nothing.

### 10.2 Mutts: 216 authored, 87 seen in 300 runs, 43 still role-less

| field | set on | share |
|---|---|---|
| `id`, `name`, `packSize`, `damage`, `speed` | 216 | 100% |
| `role` | 173 | **80%** |
| `inflicts` | 151 | 70% |
| `terrainPreference` | 146 | 68% |
| `fearAura` | 93 | 43% |
| `persistent` | 42 | 19% |
| `nocturnal` | 36 | 17% |
| `homeZone` | 13 | 6% |

Role distribution: `herder` 39, `swarm` 38, `ambusher` 37, `parasite` 20,
`mimic` 14, `siege` 13, `scavenger` 12, **none 43**.

`AUDIT-4 §10.2` reported 196 authored / 166 seen / 37 role-less. The roster has
grown by 20 and the role-less count has grown by 6, so the gap is being
maintained rather than closed. A role-less mutt falls back to generic behaviour,
which is why the two biggest role buckets (`herder`, `swarm`) are the two that
most change how a fight reads.

**87 of 216 named in 300 runs (40.3%)** is the reach figure, and it is gated by
arena *and* terrain, so it is not a bug. `nocturnal` at 17% and `homeZone` at 6%
are the two columns where more use would most change what a run feels like — a
mutt that lives somewhere specific is a landmark.

### 10.3 Names

**The constraint holds.** Measured across all 3,200 names: **0 contain a space,
0 contain a hyphen, 0 contain an apostrophe.** There is no surname anywhere in
the data and no code path that concatenates one. `test:names` guards pool depth
and cross-district residency; the no-surname property is not guarded and should
be — a one-line regex assertion in `check-names.ts`.

The shape of the pool:

- **3,200 names** — 16 districts × 100 male × 100 female, exactly even.
- **3,009 unique**; 191 names live in exactly two districts, none in three.
- length: 2–12 characters, modal 6 (814 names), mean 6.4.
- **initial-letter distribution is heavily skewed**: S 357, C 335, B 239, T 180,
  M 178, R 175, P 168, G 161, F 161, L 141 … Q 33, Z 29, Y 21, U 15, **X 5**.

S, C and B alone are **29.1%** of every name in the game. In a twenty-four
tribute field that is seven tributes sharing three initials, which is a real
legibility cost in a feed where tributes are referred to by first name only and
there is no surname to disambiguate. Two `Sable`-shaped names in one cast read as
the same person at a glance.

**Two things worth doing:**

1. **Flatten the initial distribution** when adding names — the next 400 names
   should be weighted toward the bottom half of the alphabet, not drawn evenly.
2. **Add a third gender pool.** `DISTRICT_NAMES` is
   `Record<number, Record<'Male' | 'Female', string[]>>` and the reaping picks
   one of two. A neutral pool is a data addition, not an engine change, and it is
   the one axis of cast variation the generator cannot currently express.

### 10.4 Flavour: where more *types* are needed

`flavorText.ts` exports **51 pools**. Measured depth against measured draws per
run (from `check-flavor-pools`):

| pool | lines | draws/run | ratio |
|---|---|---|---|
| `SANITY_TEXTS.ruinStealth` | 20 | 11.7 | **1.7x** |
| `SPONSOR_TEXTS` | 31 | 16.1 | **1.9x** |
| `VENGEANCE_TEXTS` | 24 | 12.3 | **2.0x** |
| `SANITY_TEXTS.hallucination` | 20 | 8.0 | 2.5x |
| `GRIEF_TEXTS` | 55 | 13.4 | 4.1x |
| `INTIMIDATION_TEXTS` | 18 | 4.1 | 4.4x |
| `SANITY_TEXTS.dropItem` | 20 | 4.5 | 4.4x |
| `BETRAYAL_AFTERMATH_TEXTS` | 32 | 3.5 | 9.1x |
| `RELIEF_TEXTS` | 18 | 1.3 | 13.8x |
| `AMBIENT_TEXTS` | 24 | 1.6 | 15.0x |

**The three pools under 2.0x are the ones a player notices repeating.**
`SPONSOR_TEXTS` at 1.9x is the worst offender in absolute terms: sponsor gifts
fire 18.3 times per run in 95% of runs, and there are 31 lines. A single run
draws each sponsor line roughly twice.

Beyond depth, the *type* gaps:

- **`LEGENDARY_ITEM_TEXTS` is a type that exists and is unreachable** (§1.4). One
  hard-coded sentence covers a moment that happens twice a run.
- **Epithets are deep and the tail is proper nouns.** 135 distinct epithets in
  200 runs, but the tail is `the One Who Outlasted <zone>`,
  `the Butcher of <zone>`, `the Red Hour of <zone>` — one template per zone name.
  The head of the distribution is the authored set (`the One Who Did Not Slow
  Down` 29, `the One the Cannons Follow` 25, `the One They Stopped Naming` 25).
  More authored epithets; fewer zone-interpolated ones.
- **Interview scenarios are exactly 15 success / 15 failure across all 13
  personas**, which is even and shallow — a persona's interview is 30 lines deep
  and personas persist to the epilogue.
- **Death causes are 102 templates, 92 of them at under 5% of deaths combined**
  (§7.2), and the variety in the tail is mostly zone names.
- **`ARCHETYPE_SIGNATURE_TEXTS.careerDeclaration` at 8 lines** is the thinnest
  nested pool in the game (floor is 8), and Career is the most-played archetype
  (3,497 entrants at n=1,600, 21.9% of the field).

### 10.5 Incomplete: the item layer

52 items across 7 kinds: `weapon` 12, `utility` 11, `food` 9, `medical` 7,
`tool` 6, `armour` 4, `water` 3.

`items.ts` has a complete `ItemCondition` model with `conditionTier` and
`salvageInto` (combining a broken item into a kept one), and `carryCapacity`
gated by `hasBackpack` — which is dead (§1.5). Measured: **73.0% of living
tributes carry a weapon** at n=1,600, against a guard of ≥40%, so the weapon
economy is healthy.

Three items of `water` kind against a `noWaterExceptZone` law on 30 arena
instances and dehydration as the single largest death template (351 of 6,912) is
the thinnest match between an item category and the pressure it answers.

---

## §11 — More achievements to add

### 11.1 Where the layer is

**193 achievements**, all evaluating without error against several hundred
arbitrary end-states. Over 500 runs:

- **114 in the usable 5%–60% band (59.1%)**
- **11 never unlock**
- **7 fire on 60%+ of runs**
- **11 rarity labels contradicted by their measured rate**
- 85 numeric-threshold tests, **85 carrying a `nearMiss`**, 0 exempt
- 122 of 193 carry a `nearMiss` closure overall
- **2 of 193 carry `availableIn`**

Rarity distribution as labelled: `rare` 85, `legendary` 53, `common` 47,
`possible` 8.

### 11.2 The never-unlocked eleven are three different problems, not one

Worth separating, because the fixes differ:

**(a) Victor-scoped predicates over field-common states — 4 entries.**
`the-unwitnessed` (34.6% of tributes qualify, no victor can), `the-quiet-one`,
`cartographer` (8 of 9,600 tributes did it; none was the victor), `arms-dealer`
(1.16% of tributes, 1.03% of victors — this one *does* fire, §1.6).
**Fix:** drop the victor requirement on two of them and let the achievement be
about a *tribute* rather than the winner. The game already tracks the fallen.

**(b) Compound improbabilities — 4 entries.** `scarred-and-standing` (two scars
on a victor: 0 in 400 runs, §1.7), `grey-market` (two of three economy roles),
`nobody-drowned` (three water zones AND a long run AND no drownings),
`reflection-survivor` (one Quell of 28, in 7.3% of runs, plus a victor).
**Fix:** loosen one term. `grey-market`'s own comment records that this was
already done once, from three terms to two; it needs one more step.

**(c) Config- or mode-gated — 3 entries.** `the-short-week` (needs a small field
or a compressed temperament, §1.8), `twelve-levers` (needs gamemaker mode, and
correctly carries `availableIn`), `every-door` (needs an arena with enough
once-per-run events — and the five floor arenas have exactly 4).
**Fix:** `availableIn` on all three. Only 2 of 193 entries use it, and this is
what it is for.

### 11.3 The seven near-automatic entries

`outlived-the-map` 87.4%, `made-them-blink` 78.2%, `changed-by-it` 67.8%,
`kept-word` 64.0%, `the-token` 60.4%, `nobody-came` 60.2%, `named-early` 60.0%.

Seven participation ribbons on a list of 193 is not a crisis, but `outlived-the-map`
at 87.4% is a card that fires nearly every run. Raise its threshold.

### 11.4 The eleven drifted rarity labels

The check reports them and does not fail on them, which the README says it should:
*"A rarity label two bands off its measured rate is now a build failure rather
than a line in a report."* The eleven currently listed are all **one** band off,
so the guard is working as specified — but three of them are at the edge:

| entry | labelled | measured |
|---|---|---|
| `a-weapon-with-a-name` | rare | **35.6%** |
| `it-changed-hands` | rare | **35.6%** |
| `named-blade` | rare | **35.6%** |
| `sole-of-two` | common | 23.8% |
| `the-tally` | common | 23.8% |
| `quiet-storm` | common | 23.2% |
| `arena-wins` | common | 22.2% |
| `nightlock-ending` | common | 5.0% |
| `no-victor` | rare | 2.8% |
| `unfilmed` | rare | 2.4% |
| `four-skills` | rare | 2.2% |

The three weapon-naming entries at exactly 35.6% are the same underlying event
(§1.4: weapons are named in 91.3% of runs), and three achievements firing off one
moment at an identical rate is a redundancy worth collapsing.
`ACHIEVEMENT_EMIT_RARITY=1` regenerates the set from data.

### 11.5 Achievements to add, keyed to state that already exists

Every one of these reads a field the engine writes today. Category counts are
given because §11.6 is about the imbalance.

**Arena (currently 28) — the section with the most unused state:**

1. **Cartographer's Apprentice** — a tribute (not necessarily the victor) stood
   in every zone. Measured reachable: 8 of 9,600. Fixes §11.2(a).
2. **Read the Room** — a victor who never entered a zone carrying an active
   `ZoneEffect`. All ten effect kinds are tracked per zone per cycle.
3. **The Long Way** — a victor who crossed a `hidden` edge. 15 exist across the
   roster and nothing marks using one.
4. **Toll Paid** — crossed a `tolled` edge. 28 exist.
5. **Burned the Bridge** — was the last tribute across a `collapsing` edge
   before it went. 13 exist, `crossings` is tracked per edge.
6. **Under Two Suns** — won in an arena with a stacked pair of laws. 16 stacked
   pairs are proven by `test:arenas`.

**Social (currently 48 — the largest, and still has gaps):**

7. **The Fourth Term** — an alliance whose charter hardened three times in one
   run. `allianceCharter.ts` already tracks added rules.
8. **Both Sides** — held a bloc treaty and then broke it. Fires at 1.3%, §4.2.
9. **Liar's Dividend** — planted a rumour that another tribute died acting on.
   `rumours.ts` tracks the plant, the mark and the arrival.
10. **Full Table** — an alliance that named all four roles. Measured: 2,768 of
    7,302 samples, so this is a `common`.
11. **Paid in Full** — cleared every debt owed. `debts.ts` has `debtTo`,
    `clearDebt`, `clientsOf`, all file-internal.

**Survival (currently 24):**

12. **One Scar** — a victor with one scar. Measured 5 of 389 victors: `legendary`,
    and it is what `scarred-and-standing` should have been (§1.7).
13. **Never Slept** — a victor who never rested a full night. `survival.ts`
    tracks sleep and `sleepDeprivation` exists.
14. **The Dominant Hand** — won after taking a wound to the dominant arm.
    `handedness` and `scars.arms` both exist (§3.4).

**Combat (currently 20):**

15. **The Named Blade** — carried one legendary weapon from naming to victory
    without it changing hands. `legendName` and `namedWeapons` exist; this is the
    entry the three redundant 35.6% ones should be collapsed into (§11.4).
16. **Nobody's Trap** — killed by a trap they set themselves. Needs §7.3(2)
    first.

**Capitol (currently 22):**

17. **The Quiet Year** — a run with no Quell, no wildcard beyond the calendar,
    and no Gamemaker intervention. All three are counted.
18. **Full Purse** — a victor who received a gift from every sponsor bloc.
    `sponsorBlocs.ts` tracks blocs.

**Oddity (currently 18):**

19. **Outlived the Arena** — the victor's last zone was one that had already
    collapsed and reopened. `collapsedZones` is tracked.
20. **The Whole Menagerie** — saw every mutt in an arena's roster in one run.
    Rosters run 2–8 mutts.

**Games (currently 17 — the smallest):**

21. **Even Field** — a Games where every district lost exactly one tribute before
    the final eight.
22. **The Long Week** — a run past day 15. Measured mean is 9.2, sd 2.15, so this
    is roughly a 3-sigma run: a real `legendary`.

**Reaping (currently 16):**

23. **All Volunteers** — win the `all-volunteer` cast shape. One of 8 shapes.
24. **The Youngest** — the youngest tribute in the field wins. Ages are tracked
    and `strengthCapForAge` exists.

### 11.6 Category imbalance, unchanged

| category | entries | share |
|---|---|---|
| social | 48 | 24.9% |
| arena | 28 | 14.5% |
| survival | 24 | 12.4% |
| capitol | 22 | 11.4% |
| combat | 20 | 10.4% |
| oddity | 18 | 9.3% |
| games | 17 | 8.8% |
| reaping | 16 | 8.3% |

Social is three times reaping. `AUDIT-4 §11.2` reported the same imbalance and it
has not moved. The suggestions in §11.5 are weighted toward `arena`, `games` and
`reaping` deliberately.

---

## §12 — More traits, skills, archetypes and the rest of the character layer

This section is new to this audit — the previous four treated it inside the
balance section, and it is a content question rather than a balance one.

### 12.1 What exists now

| layer | count | notes |
|---|---|---|
| traits (rollable) | **53** | assigned at the reaping |
| traits (earned) | **17** | granted mid-run by `earnedTraits.ts` |
| `TraitMod` hooks | **51** | every one read at exactly one site |
| archetypes | **15** | 18 columns, 2 sparse (§8.3) |
| proficiencies ("skills") | **9** | `forage melee ranged medicine tracking persuasion climbing swimming crafting` |
| quirks | **85** | all mechanical, 41 mod keys |
| personas (interview) | **13** | 15 success + 15 failure scenarios each |
| stances | conditional set incl. `fortify scavenge shadow flail` | authored per arena by all 40 legacy arenas |
| objectives | **8** | `survive reach hunt flee protect hold stalk wait` |
| epithets | 135 distinct observed | authored + zone-interpolated |

### 12.2 Nine proficiencies is the thinnest layer, and the gaps are specific

Nine skills against 53 traits, 85 quirks and 15 archetypes is a small vocabulary,
and the measured means (§3.3) show it is also unevenly exercised:
`crafting` 2.29 down to `medicine` 1.07.

**Five skills the engine already has the occasions for:**

1. **`stealth`** — there is a `stealth` *attribute* and a whole `stealth.ts`
   engine with `concealment`, `ambush` and `endgameVisibility`, and no
   proficiency that improves with use. It is the one obvious omission: a tribute
   who has hidden successfully twenty times should be better at it.
2. **`intimidation`** — `INTIMIDATION_TEXTS` fires 4.1 times per run,
   `fear.ts` is a complete subsystem, `fearAura` is on 93 mutts, and
   `Feared` is the second-highest-winning earned trait. Nothing gets better at it.
3. **`butchery` / field-dressing** — `Vulture` is the highest-winning earned
   trait (57.6%), looting is a per-run behaviour, and `scavenge` is a `TraitMod`
   carried by 4 traits. There is a `forage` proficiency for plants and none for
   what is left after a fight.
4. **`navigation`** — `memory.ts` models an unreliable map, `zoneSightlines`
   exists, mean map coverage is 29.8% (§3.2). A tribute who gets better at
   reading ground is the skill that would most change movement.
5. **`endurance`/`pacing`** — `fatigueDay` and `fatigueNight` are separate mods
   carried by 3 and 2 traits, `noRest` is a law, and nothing improves with
   practice.

### 12.3 Twelve traits worth adding, each expressible in existing `TraitMod` keys

No new hooks needed for any of these. Nine `TraitMod` keys are currently carried
by exactly one trait each (§8.6), which is the clearest signal of where the
vocabulary is under-used.

**Filling the single-carrier keys:**

| trait | mods | fills |
|---|---|---|
| **Frostbitten** (earned) | `coldResist +0.3, fatigueNight +1.0` | `coldResist` has **one** carrier and the roster has four ice arenas |
| **Camel** | `thirstDrain -1.5, heatResist +0.1` | `thirstDrain` has one carrier; dehydration is the largest death template |
| **Grappler** | `wrestle +0.4, unarmedPower +1.5, retreat -0.1` | `wrestle` has one carrier |
| **Kindler** | `burnOnHit +0.15, burnResist +0.2` | `burnOnHit` has one carrier (`Pyromaniac`) |
| **Houndsman** | `muttDamage -0.15, awareness +0.4` | `muttDamage` has one carrier; mutts are 3.82% of deaths |
| **Crowd-Pleaser** | `sponsorAppeal +1.5, excitement +0.2, concealment -0.05` | `sponsorAppeal` has one carrier |

**Filling behavioural gaps the engine supports:**

| trait | mods | why |
|---|---|---|
| **Sleepless** (distinct from `Insomniac`) | `fatigueNight +2.0, awarenessNight +0.8, sanityDrain +0.15` | `noRest`/`deadlyNight` are laws with no trait that answers them |
| **Deep-Lunged** | `water +0.5, swimming` | 3 water items, 4 water-heavy arenas, `Swimmer` is a 2-mod trait |
| **Sure-Footed** | `highland +0.5, retreat +0.1` | `highland` has one carrier; `elevationOrChoke` gates 21 events |
| **Quartermaster** | `capacity +2, scavenge +0.3` | `capacity` has two carriers; alliances name a `quartermaster` role 3,068 times |
| **Unlucky** (drawback) | `odds -0.3, targetDraw +1.0` | only one clear drawback trait exists (`Fragile`, bottom of the table at 3.58%) |
| **Witness** (earned) | `griefResist -0.2, resolveDrift +0.3, betrayalResist +0.2` | `BETRAYAL_WITNESS_TEXTS` exists as a pool; nothing changes about seeing one |

### 12.4 Four archetypes worth adding

Fifteen archetypes with a 2.94x win spread (§8.1) is close to balanced, so new
ones should be added for *behavioural* variety rather than to fill a power band.
The four below each occupy a `stanceBias`/`objectiveBias`/`targetPreference`
combination no existing archetype holds:

1. **The Scavenger** — `targetPreference: 'richest'`, high `caution`, low
   `aggression`, `objectiveBias` toward `reach`. Follows fights rather than
   starting them. `Vulture` is the best-performing earned trait and no archetype
   is built around arriving second.
2. **The Hostage-Taker** — `targetPreference: 'weakest'`, high `treachery`,
   *high* `allianceAffinity`. Keeps somebody alive because they are worth
   something. `debts.ts` and `parley.ts` both model coercion and no archetype
   leans on it.
3. **The Bellwether** — `targetPreference: 'rival'`, `objectiveBias` toward
   `hold`. Picks ground and makes everyone else come to it. `hold` is the
   second-rarest objective (131 of 4,808 samples, 2.7%) and `zoneControl.ts`
   surfaces in 9.7% of runs (§6.6) — this is the archetype that would use both.
4. **The Confessor** — very high `allianceAffinity`, near-zero `aggression`,
   `objectiveBias` toward `protect`. Wins by being the person nobody can justify
   killing. `Merciful` and `Pacifist` exist as traits; `medic` and `diplomat`
   are the nearest archetypes and both are combat-capable.

Each also wants a `hatesArchetypes` entry, which would take that column from
9/15 to 13/19 (§8.3).

### 12.5 Two things to widen rather than add

1. **`preferredTraits` is 2–3 entries on every archetype out of 53 rollable
   traits.** Widening it to 4–5 on the bottom five archetypes is the cheapest
   balance lever in the game (§8.2) *and* the cheapest identity lever — an
   archetype that reliably reaps four related traits reads as a character.
2. **`targetPreference` has 5 values and `weakest` is used by 6 of 15
   archetypes.** Two more values — `'ally-of-rival'` and `'whoever-is-loudest'`
   (the latter reads `notoriety.ts`/`exposure.ts`, both live) — would separate
   archetypes that currently make the same choice.

### 12.6 The interview persona layer is even and shallow

13 personas, **exactly 15 success and 15 failure scenarios each** — 390 lines
total, perfectly uniform. Personas persist into `persona.ts`'s drift model and
into the epilogue, so they are not cosmetic.

Uniformity at exactly 15/15 across all thirteen is the signature of content
written to a checker's target rather than to the persona (the flavour checker's
target for this pool is 15). Two or three personas deserve to be deeper than the
others — `The Wildcard` and `The Quirky Oddball` in particular, since their whole
premise is unpredictability and 15 lines is a small space to be unpredictable in.

Three personas the set does not have, all of which the engine can already
express: **The Volunteer** (`all-volunteer` cast shape exists),
**The Returning Victor** (`veterans.ts` grafts them, 1.8% of runs),
**The Bereaved** (distinct from `The Grieving Sibling` — someone who lost
somebody in a *previous* Games, which `panemStorage` tracks).

---

## Closing: the twelve things worth doing first

Ordered by ratio of effect to cost, not by section.

1. **Write the five missing arena signatures** (§5.7) and **add the roster guard
   that would have caught them** (§1.1). One bug, five arenas, four sections.
2. **Add the `SIGNATURE_BLURBS` coverage assertion** to `validate-arenas`, and
   write the five blurbs (§1.2, §2.1).
3. **Wire `LEGENDARY_ITEM_TEXTS`** into `legendaryItems.ts:97` — one line, and it
   fixes a pool that is drawn twice a run in nine runs out of ten (§1.4).
4. **Make `check-flavor-pools` enumerate exports rather than a list** (§6.5), so
   the next dead pool fails CI instead of waiting for an audit.
5. **Wire `evaluateInRunNearMisses` into `GameScreen`** (§2.2). The function is
   written, tested and defensive; it needs a consumer.
6. **Call `describeSignatureRule`** for procedural arenas in `SetupScreen`
   (§1.3). Same shape: written, tested, no consumer.
7. **Fix the four mis-specified achievements** — `scarred-and-standing` down to
   one scar, `the-short-week` and `every-door` given `availableIn`,
   `arms-dealer` relabelled `legendary` (§1.6–§1.9, §11.2).
8. **Widen `preferredTraits` to 4–5 on the bottom five archetypes** (§8.2,
   §12.5). The cheapest available fix for the 2.94x spread and it touches no
   combat number.
9. **Redistribute `dodgeStat` and fill in `dodgeAlt`** (§5.5). Agility and
   intelligence are 68.6% of every roll the arena asks for, and `charisma` is 4
   events out of 1,241.
10. **Give bloc treaties a fourth, non-violent ending** (§4.2). Three-quarters of
    the treaties the game forms never resolve on screen.
11. **Lower the two ratchets that have reached their ceilings** — hover-only
    hints 30→24 (§2.3) and `traits.includes` 44→40 (§3.5). A ratchet at its
    ceiling has stopped ratcheting.
12. **Double the mutator set from six to twelve** (§6.4, §9.5). It is the
    thinnest replayability axis and the only one the player chooses.

### One observation about the shape of the remaining work

Across five audits the failure mode has changed. The first three found broken
code. The fourth found taxonomies with dead members. **This one found four
complete, correct, tested features with no consumer** — `evaluateInRunNearMisses`,
`describeSignatureRule`, `LEGENDARY_ITEM_TEXTS`, `zoneAcoustics` — and one whole
engine subsystem silently absent from five arenas, all of it invisible to a
sixteen-check roster that passes clean.

The checks that exist test whether the data is *well-formed*. What is missing is
a class of check that tests whether the data is *reached*: every exported flavour
pool has a draw site, every arena has a signature, every engine module that logs
has a measured fire rate above zero. Three such checks would have caught every
finding in §1 of this report.
