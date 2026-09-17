# Survival Games — sixth full audit (12 sections)

## Context

Taken against `main` at `efcb004` ("Merge pull request #60"), after `AUDIT.md`,
`AUDIT-2.md`, `AUDIT-3.md`, `AUDIT-4.md`, `AUDIT-5.md` and the fix passes
recorded in `CHANGELOG.md`. Written to the twelve headings the request named.

**Nothing below is merged into a neighbouring section.** Where a finding belongs
in two places it is stated twice, in each section's own terms, because a report
whose sections quietly borrow from each other cannot be read one section at a
time. §1.1 is also §2.1; §5.2 is also §7.3; §8.1 is also §12.1 — each in that
section's own language, with that section's own remedy.

Every number here was measured on this commit, either by the repository's own
check roster or by nine throwaway probes written against `Simulator`'s public
API (`processTraining`, `processInterviews`, `startGames`, `processBloodbath`,
`processTurn`, `getState`) plus a Playwright walkthrough of the live dev server.
All probes were deleted after measurement. Where this report says "never", it
means a counter that stayed at zero across a stated number of complete runs.
Where it says "cannot", it means a path proved unreachable by reading.

### The repository, on this commit

| area | files | lines |
|---|---:|---:|
| `src/data` | 34 | 48,827 |
| `src/engine` | 86 | 35,483 |
| `src/components` | 37 | 8,258 |
| `src/screens` | 9 | 5,030 |
| `src/utils` | 11 | 3,245 |
| `src/models` | 1 | 2,619 |
| `src/store` | 5 | 1,861 |
| `src/ui` | 5 | 250 |
| **total** | **188** | **105,911** |

### The check roster, on this commit

Fifteen of the sixteen headless checks pass. The sixteenth — the only one that
opens a browser — fails on more than half its steps and **is not in CI.**

| check | in CI | result |
|---|---|---|
| `lint` | yes | clean |
| `test:sim` (400 runs) | yes | passes, no invariant violations |
| `test:metrics` (400 runs) | yes | 25/25 regression guards hold; 8 goals unmet |
| `test:metrics` (1,600 runs) | — | 25/25 guards hold; **11 goals unmet** |
| `test:decisions` (40 runs, 5,366 cycles) | yes | passes; stance-best 54.8%, destination-best 72.8% |
| `test:achievements` (500 runs) | yes | passes; 207 entries, **10 never unlock**, 7 near-automatic, **13 rarity labels contradicted** |
| `test:arenas` | yes | passes; 45 authored arenas + procedural, 52 mutt rosters, 216 mutts, 103 edge rules |
| `test:arena-layout` | yes | passes; 165 layouts, 0 label collisions, 46px zone touch target |
| `test:flavor` | yes | passes; **40 of 44 packs under the soft target**, 277 events to go |
| `test:names` | yes | passes; 3,584 names + 204 mentors; 251 in two pools, none in three |
| `test:knobs` | yes | 2,220 knobs across 131 groups, all referenced |
| `test:undeclared-knobs` | yes | no new drift |
| `test:predicates` | yes | clean; 43 `traits.includes()` sites (ceiling 44) |
| `test:zone-features` | yes | every zone authors an interior |
| `test:storage` | yes | migration cases pass |
| `test:unnamed` | **no** | passes |
| `test:ui-affordances` | **no** | passes; 19 hover-only hints (ceiling 21), 0 unnamed value hints |
| `test:ui` (Playwright) | **no** | **22 pass / 24 fail** |

### The probes

1. **Death-cause probe** — 300 runs across all 45 arena ids plus procedural;
   5,434 deaths; 434 distinct cause templates after name/number normalisation.
2. **Signature-death probe** — 540 runs (12 per arena); 145 death *shapes* after
   zone normalisation; classifies each as universal or arena-owned.
3. **Arena-layer probe** — static; eleven authored columns across all 45 arenas.
4. **Social probe** — 200 runs; 3,384 alliance samples of size ≥2; 472,448
   relationship readings.
5. **Content-reach probe** — 300 runs, 5,728 tributes; quells, temperaments,
   cast shapes, epithets, traits, quirks actually seen.
6. **Off-season / legendary probe** — 300 runs; skins, head Gamemakers, named
   weapons.
7. **Prose-regex probe** — 120 runs; replays every literal regex in `soak.ts`
   against the live log to find assertions that no longer match anything.
8. **Browser walkthrough** — Chromium at 1400px, 768px and 380px; tap-target
   census, overflow census, pager and label inspection.
9. **Content-inventory probe** — static counts of every authored roster.

---

# §1 — All bugs

Ordered by severity. Each is reproducible on this commit.

## 1.1 `test:ui` fails 24 of its 46 steps, and it is not in CI — *blocker*

`npm run test:ui` is the only test in the repository that opens a browser. On
this commit it reports:

```
22 passed
24 failed
```

The failing steps:

```
✗ locked arenas are shown but not selectable
✗ confirm reaping opens roster + betting
✗ search and sort roster
✗ roster filters narrow the cast
✗ betting deducts and refunds coins
✗ begin training moves to arena
✗ proceed advances phases
✗ a moment can be copied on its own
✗ two tributes can be compared side by side
✗ filters panel mutes categories
✗ the chronicle page pages by phase
✗ arena map tab + sector selection
✗ standings tab sorts
✗ tribute modal opens with live data and closes with Escape
✗ gamemaker controls fire
✗ speed controls engage and can be stopped
✗ run to end finishes the games
✗ victor interview then debrief
✗ debrief tabs work
✗ hall of fame records the victor
✗ new keyboard shortcuts drive the arena
✗ O opens the watched tribute and X filters the chronicle to them
✗ shortcuts do not hijack typing in the chronicle search
✗ the arena and the tribute sheet both fit a 380px phone
```

Every failure traced was a **stale assertion following an intentional UI
change**, not an application defect:

- `confirm reaping opens roster + betting` waits for a heading `The Tributes`
  and the text `capitol betting parlour`. `router.ts` says, in its own comment,
  *"§(requests 5): the roster is a tab inside the arena now"* and
  *"§(requests 7): confirming the reaping lands on the chronicle"*. The app does
  exactly that. The test still drives the old flow, times out after 30s, and
  **every one of the twenty steps after it cascades**, because the run never
  leaves the pre-Games screen.
- `locked arenas are shown but not selectable` looks for per-arena rows named
  `Undiscovered arena — locked`. `SetupScreen.tsx:851` renders the locked
  remainder as **one summary line** — *"§7: the locked remainder, as one line
  rather than forty identical rows"*. There is no such row to find.

That is the finding, and it is worse than a broken feature: **a harness that
fails 52% of its steps for known-good reasons has no signal left.** A genuine
regression in the arena screen, the tribute modal, the Gamemaker booth, the
speed controls, the victor interview, the Hall of Fame write or the 380px
layout would land inside this wall of red and be indistinguishable from it.

`.github/workflows/ci.yml` states the reason it is excluded — *"it needs
`npm run dev` on port 3000 and a Playwright browser download, which is its own
job and its own runtime budget"* — and that reasoning is sound for the *cost*
and wrong about the *consequence*: nothing else in the repository executes a
single line of `src/components` or `src/screens`. 13,288 lines of interface code
have zero automated coverage on every pull request.

**Fix:** (a) re-point the 24 stale steps at the current flow — reaping →
chronicle → `Hold the reaping` → the staged pre-Games buttons → arena tabs;
(b) add a `ui` job to `ci.yml` that runs `npm run dev &`, waits on port 3000,
and runs `test:ui` with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` against a cached
browser; (c) make the harness fail loudly on the *first* navigation timeout
rather than repeating it 24 times, so a broken flow reads as one failure and not
as twenty-four.

## 1.2 Two `soak.ts` counters have read zero forever because their prose was rewritten

`soak.ts` asserts and reports on 99 prose regexes. Replayed against 120 complete
runs, 95 matched at least once. Four did not; one of those (`/\{[a-z0-9]+\}/`,
the placeholder-leak guard) is *supposed* to never match. The other three:

| site | counter | regex | status |
|---|---|---|---|
| `soak.ts:502` | `treatiesSworn` | `/anybody made on behalf of somebody else/` | **dead** — string absent from `src/` |
| `soak.ts:539` | `successionUnnamed` | `/nothing agreed about what happens next/` | **dead** — string absent from `src/` |
| `soak.ts:504` | `treatiesLapsed` | `/Nobody renews it and nobody breaks it/` | live, but rare (6 in 400 runs) |

The visible symptom is the line the 400-run soak prints:

```
blocTreaties: sworn=0 brokenByAKilling=2 lapsed=6 endedByTheField=6
```

Fourteen treaties *ended* and zero were *sworn*. The treaties are fine —
`blocTreaty.ts:149` swears them and increments `state.blocTreatiesSworn` — but
the prose it logs was rewritten under the `§22` change to
*"agree a truce between their groups and take it back to them"*, and nobody
updated the probe. The same applies to `succession: … noHeirNamed=0`.

This is the general failure, not two typos: **`soak.ts` measures the engine by
grepping its English.** Any prose edit silently deletes a metric, and because
these particular counters are reported rather than asserted, the roster stays
green while its coverage erodes.

**Fix:** move both to engine counters (`state.blocTreatiesSworn` already exists
and is unread by the probe), and add a meta-assertion to `soak.ts` — every
prose regex must match at least once across the sweep, or the run fails naming
the dead one. That single assertion would have caught both on the commit that
broke them.

## 1.3 The off-season skin system is unreachable from every headless check

`offSeasonFor()` and `applyOffSeason()` are called from exactly one place:

```
src/store/gameStore.ts:972:  const skin = offSeasonFor(safeSeed, arena);
src/store/gameStore.ts:973:  if (skin) applyOffSeason(arena, skin);
```

`gameStore.newGame` is the UI path. `soak.ts`, `metrics.ts`,
`check-decisions.ts`, `validate-arenas.ts` and `check-flavor-pools.ts` all
build their own `GameState` literal and never call it. A 300-run probe
constructed the same way saw **0 of 40 skins in 0 of 300 runs.**

That would be a cosmetic gap if the skins were cosmetic. They are not: the
comment at the call site says a season *"may lift the arena's own law, impose
one of its own, or shift what the ground yields and what it costs to cross"* —
so 120 skin definitions across 40 arenas can change laws, yields and traversal
cost, fire at an 18% rate for every real player, and are exercised by nothing.

**Fix:** hoist the arena-resolution block (clone → off-season → Quell law
override → `lawZone` default) out of `gameStore.newGame` into one exported
`resolveArenaForRun(seed, arenaId, gamesProfile)` in the engine, and have every
harness call it. Then add a skin-reach line to `soak.ts` the way arena events
already have one.

## 1.4 The chronicle pager renders `1 / 0` with an enabled `Previous page`

Immediately after `Confirm tributes`, before any phase has run, the chronicle
screen shows:

```
PREVIOUS PAGE
1 / 0
HOLD THE REAPING
```

A page counter reading `1 / 0` is arithmetic that cannot be true, and the
`Previous page` control is rendered in its normal state next to it. The screen
is otherwise correct — the empty-state copy ("The cast is confirmed and the
record is empty") is right there above it.

**Fix:** when `pages.length === 0`, render the pager as `—` (or suppress it) and
disable both paging controls.

## 1.5 `packFor`'s own docstring is false

```ts
/** The pack this arena draws from. Every arena has one; most have their own. */
export function packFor(arena) {
    return ARENA_EVENT_PACKS[arena.eventPack ?? arena.id] ?? UNIVERSAL_PACK;
}
```

`ARENA_EVENT_PACKS` has **11 entries** against **45 arenas**. "Most have their
own" is 24%. This is a documentation bug with a design consequence (§5.2), and
it is the kind that hides the design consequence: a reader of `packFor` comes
away believing the arena layer is well covered.

**Fix:** correct the comment to state the real ratio, and add a line to
`validate-arenas.ts` reporting how many arenas fall back to `UNIVERSAL_PACK`
so the number is visible in the roster instead of only in the data file.

## 1.6 Interactive tribute-name badges are glued to the name in the accessible layer

`EventFeed.withTributeLinks` renders each linked name as:

```tsx
<button title={`${person.name} — District ${person.district}, …`}>
    {part}
    <span className="… align-super">{person.district}{gender === 'Male' ? 'M' : 'F'}</span>
</button>
```

Visually this is a superscript badge and it reads well. In the accessible
layer — and in anything that reads `textContent` — the button's name is
`Scepter1M`, `Alabaster1F`, `Obelisk2M`. A screen reader announces *"Scepter one
M"* mid-sentence, several times per line. The `title` is also a hover-only hint
on a control, which is the exact pattern `check-ui-affordances` exists to
ratchet down; these are counted, but the badge itself is not.

**Fix:** `aria-hidden="true"` on the badge span, and move the district/gender
into the button's `aria-label` (or a `Hint`, which the repository already has
for precisely this and which works on touch and on focus).

## 1.7 Risk register: things that are *not* bugs but are one edit away

- `snapshot.ts` prefers `structuredClone` and falls back to the JSON round-trip.
  Correct, bounded, and the rewind ring is capped at 16. **No action.**
- No `Math.random` anywhere in `src/engine`, `src/data` or `src/utils` except
  `sound.ts` (audio noise, correctly non-deterministic). **No action.**
- 14 `as any` casts and 0 `@ts-ignore` across 105,911 lines. **No action.**
- `check-undeclared-knobs` carries a JSON baseline (`undeclared-knobs-baseline.json`).
  A baseline that is never re-driven to zero becomes permanent. **Schedule a
  reduction target**, the way `TITLE_CEILING` is ratcheted.

---

# §2 — All QOL, UI and UX updates needed

## 2.1 There is no browser coverage in CI at all — *the QOL blocker*

Stated in §1.1 as a bug. Stated here as a quality-of-life problem: a contributor
changing `GameScreen.tsx` or `TributeModal.tsx` gets a green pull request and no
information. The 13,288 lines under `src/components` and `src/screens` are the
only part of this repository a player ever touches directly, and they are the
only part with no test gate. Every UI finding below was found by hand in a
browser this afternoon because nothing else was going to find it.

## 2.2 Tap targets: 168 of 168 interactive elements are under 44px at phone width

Measured at 380px on the pre-Games chronicle, the widest-coverage screen in the
app:

| threshold | count | of |
|---|---:|---:|
| minimum dimension < 44px (WCAG 2.5.5 enhanced) | 168 | 168 |
| minimum dimension < 32px | 164 | 168 |
| minimum dimension < 24px (**WCAG 2.5.8 minimum — a failure**) | 155 | 168 |

The worst offenders are the inline tribute-name buttons from §1.6, at
**19px tall**, sitting adjacent to each other inside running prose — on a phone
they are effectively un-tappable and mis-tappable. The primary navigation links
are 29px. The seed chip is 20px.

The repository already knows this rule: `check-arena-layout.ts` enforces a
**44px** zone touch target on the SVG map and reports `46px at the 460px minimum
graph width (floor 44px)`. That floor exists for the map and for nothing else.

**Fix:** (a) extend `check-ui-affordances.ts` — or add `check-touch-targets` —
to assert a real DOM tap-target floor at 380px, baselined and ratcheted the way
`TITLE_CEILING` is; (b) give inline name buttons vertical padding and an
`inline-block` box so they reach 24px without breaking the line; (c) raise nav
links and chips to 32px at phone width.

## 2.3 The arena picker's cards are single buttons with 1,500-character names

Selecting an arena on the setup screen means activating a button whose entire
card body — description, law explainer, terrain mix, the full set-piece list,
the mutt roster — is inside the button. The accessible name of one card, read
verbatim:

> "The Clockwork Island A shifting map layout divided into sectors, each
> unleashing a different horror at a specific hour. ⚙ The clock: one sector is
> struck every cycle… Ground 11 sectors — 2 open ground · 2 forest … Laws The
> horn refills gives · a real constraint … Set pieces The Twelve Hours … The
> Convergence — When six or fewer tributes are left … Mutts Tick-Tock Monkeys,
> Lightning Birds, Acid Fog, Jabberjays, Reef Barracuda"

A screen-reader user must listen to all of it to learn the button's name, for
each of the arenas in the list, and there is no way to skim. `check-ui-affordances`
cannot see this because the element *does* have an accessible name — an enormous
one.

**Fix:** make the card a region with a heading; put the selection on a short
control inside it (`Pick The Clockwork Island`); keep the body as static content
the user can read or skip. Add a check that fails any interactive element whose
accessible name exceeds ~120 characters.

## 2.4 Pre-Games is a quarter of the whole broadcast

Across 300 runs and 326,917 log lines, the category mix is:

| category | share | important |
|---|---:|---:|
| training | 14.72% | 13,123 |
| sanity | 11.64% | 27,440 |
| travel | 10.55% | 3,840 |
| system | 10.35% | 13,013 |
| interview | 10.21% | 13,597 |
| alliance | 9.25% | 10,762 |
| survival | 8.21% | 2,661 |
| combat | 7.75% | 13,238 |
| sponsor | 2.97% | 8,503 |
| arena | 2.51% | 5,549 |
| loot | 2.06% | 849 |
| injury | 1.67% | 2,308 |
| hazard | 1.53% | 3,303 |
| gamemaker | 1.35% | 4,416 |
| death | 1.18% | 3,872 |
| feast | 1.10% | 1,635 |
| kill | 1.01% | 3,287 |
| mutt | 0.98% | 1,422 |
| betrayal | **0.48%** | 515 |
| romance | **0.46%** | 1,247 |

**`training` + `interview` = 24.9% of every chronicle**, against `death` +
`kill` + `combat` + `betrayal` at 10.4%. The two beats a player is most likely to
want to re-read — a betrayal and a romance — are the two rarest lines in the
feed at under half a percent each. A reader scrolling a run reads four training
lines for every combat line.

This is not an argument for cutting the pre-Games, which is some of the best
writing in the repository. It is an argument that **the default density setting
is wrong for a first read**: the feed should open on a headline density that
weights by `important` rather than by volume, and the training and interview
pages should collapse to their scored outcomes with an expand.

`EventFeed.tsx` already has `density` and `ceremonyCollapse`. **Fix:** default
`ceremonyCollapse` on, and add a "what mattered" density that filters to
`important` and caps per-phase lines.

## 2.5 19 hover-only hints remain, and the ceiling has stopped moving

`check-ui-affordances` reports 19 `title=` attributes on controls against a
ceiling of 21, heaviest in `RosterScreen.tsx` (4), `ChronicleFilters.tsx` (3),
`DossierPanel.tsx` (3). `Hint.tsx` and `Glossed.tsx` exist and are the
documented replacements. Nineteen is small enough to finish.

**Fix:** convert all 19 and set the ceiling to 0, which turns a ratchet into an
invariant.

## 2.6 Smaller QOL items, each cheap

- **No per-moment share.** `test:ui` asserts *"a moment can be copied on its
  own"* and the app has no per-line share affordance. A run produces ~1,090 log
  lines and the only export granularity is the whole chronicle. Add a copy
  control on `important` lines (the same set the headline density uses).
- **Seed chip is 20px and unlabelled by size.** It is the single most-copied
  value in the app.
- **`Filters •` uses a bullet to mean "active".** Two controls match
  `/filters/i` on the chronicle screen (`Filters •` and `Reset filters`), which
  is also why one `test:ui` step fails on a strict-mode violation. Name the
  state: `Filters (3 active)`.
- **No horizontal overflow at 380px or 768px** on any screen sampled — this is
  genuinely good and should get a check so it stays true.
- **Nothing surfaces the 10 never-unlockable achievements** (§11.2) to the
  player as unreachable, so a completionist will hunt them forever.

---

# §3 — Tribute logic: updates, robustness, more complexity

## 3.1 Half the stance roster is decoration

Ten stances exist. Their share of all live tribute-cycles at n=1,600:

| stance | share | family | conditional |
|---|---:|---|---|
| Evasive | 37.2% | evasive | no |
| Aggressive | 30.6% | aggressive | no |
| Defensive | 15.6% | defensive | no |
| Fortified | 5.4% | defensive | yes |
| Hunting | 3.3% | aggressive | yes |
| Shadowing | 2.8% | evasive | yes |
| Desperate | 2.2% | aggressive | yes |
| Scavenging | 1.6% | defensive | yes |
| Nursing | 0.8% | defensive | yes |
| Patrolling | 0.5% | defensive | yes |

The three original stances are 83.4% of all tribute-time. **Five of the seven
conditional stances are under 3%**, and Nursing and Patrolling together account
for 1.3% — roughly one tribute-cycle in eighty. Each of those two carries a
full scorer row, a `minHold`, a blurb, and per-arena conditional action pools
(`fortify` / `scavenge` / `shadow` / `flail`, 40 arenas × 12+ lines each). That
is a large authored surface firing almost never.

`check-decisions` says the chooser is sound — stance-held-is-best 54.8%,
rank histogram `0:54.8% 1:21.3% 2:14.6% 3:9.2%`. The problem is not the
chooser; it is that the preconditions for the rare five are narrow enough that
the chooser rarely gets to rank them at all.

**Fix, in order of value:**
1. **Widen Nursing.** It currently needs a hurt *ally in the same zone*. Let it
   also cover a hurt ally on the other level of a vertical zone, a hurt
   *truce-partner*, and a hurt tribute you owe a debt to. All three already
   exist as engine concepts.
2. **Widen Patrolling** from "a pack's ground" to "any zone your alliance,
   treaty bloc or cache is in". `zoneControl` reports 524 holds per 400 runs;
   Patrolling should be the stance that produces them.
3. **Give Scavenging a reason.** It competes with Defensive, which also forages.
   Make Scavenging the only stance that can strip a cannon site or a corpse
   cache — `salvage` (a law) and `abandonedCamps.ts` already model both.
4. Report per-stance share in `test:metrics` with a floor, so a stance that
   falls below 1% fails rather than quietly existing.

## 3.2 Standing intentions are similarly top-heavy

Across 200 runs, live objective counts:

```
hunt 7051 · reach 6245 · survive 3832 · protect 2689 · flee 2378
stalk 652 · hold 619 · wait 182
```

`wait` is **0.8%** of all held objectives; `hold` and `stalk` are ~2.5% each.
The soak's own per-cycle sampling agrees: `wait=0.5%`. Three of the eight
intentions are effectively unreachable.

`wait` is the most interesting of the three and the deadest: "stay here because
somebody is coming" is the ambush premise, the feast premise and the trap
premise, and it is held by one tribute-cycle in 125.

**Fix:** give `wait` explicit generators — a set trap in this zone, a feast
announced, a treaty meeting, a Bell zone named this morning (`theBell`), a
rumour of a restock. All five are live systems that currently produce `reach`
instead.

## 3.3 Proficiency has eleven axes and a ceiling nobody reaches

Eleven proficiencies: `forage`, `melee`, `ranged`, `medicine`, `tracking`,
`persuasion`, `climbing`, `swimming`, `crafting`, `stealth`, `intimidation`.

Measured: `best proficiency avg 2.83, peak 6.00` against a cap of 6. The soak
agrees: `peakProficiency=5.78 (cap 6)`. So the *best* axis a tribute has
averages under half the cap, and the cap is touched only by outliers, in a game
whose median run is 8.5 days.

That is a defensible curve for a short run. The problem is what it implies: at a
mean best of 2.83 across eleven axes, a tribute's skill sheet is nearly flat, and
`traitProficiencyFloor` (Climber → climbing, Swimmer → swimming, Trapper →
crafting) is doing most of the differentiating. Skills are a *record* of what
happened rather than an input to what happens next.

**Fix:** make one axis per tribute compound. A tribute who has trained an axis
three times gains a small per-use bonus on that axis only — the arc exists
(`trainProficiency`) and nothing rewards specialisation over breadth.

## 3.4 Where the complexity should go next

The tribute already carries: 11 proficiencies, 10 stances, 8 objectives,
4 vitals, a wound model with infection and sepsis, fear per-target, resolve,
composure, sanity bands, notoriety, a zone-memory map with hearsay, perceived
bonds, debts, epithets, quirks and earned traits. It is not thin. The two
genuinely missing dimensions:

1. **Nothing a tribute does is *hidden from the player* the way it is hidden
   from the field.** `t.memory.zones` models belief, including `hearsay` that
   can be false — and the UI shows truth. A "what they believe" view on the
   tribute sheet would make the rumour system (163 planted, 81 exposed per 400
   runs) legible for the first time.
2. **No tribute ever changes their mind about a *plan*.** Objectives are
   re-chosen, never abandoned with a cost. An objective a tribute has held four
   cycles and then drops should be a beat.

---

# §4 — Tribute relationships and alliances

## 4.1 Three quarters of the social graph is empty

472,448 live relationship readings across 200 runs:

| band | share |
|---|---:|
| neutral (−20…20) | **75.92%** |
| bonded (60…100) | 10.82% |
| warm (20…60) | 8.09% |
| cold (−60…−20) | 4.41% |
| hate (−100…−60) | **0.76%** |

Three quarters of all pairs never leave neutral, and outright hatred is
three-quarters of one percent. The engine has `trustOf` (regard corrected by
history), `respectOf`, per-target `fear`, `RivalRecord`, `perceivedBonds`,
`notoriety` — a genuinely sophisticated stack — and the underlying scalar it all
corrects is, for three pairs in four, zero.

This is the shape of "the social systems fire, and then decay wins". Compare:
`notoriety: ledgerEntriesWithoutContact=3483` and `strangersKnownByName=148` per
400 runs — the field *knows about* people it has no relationship with, which is
the right model, and the relationship never forms because the two never meet.

**Fix:**
1. **Let reputation seed regard.** A tribute who has heard of someone
   (`notoriety` ledger, `strangersKnownByName`) should carry a small non-zero
   prior about them — positive for a protector, negative for a killer. That
   alone converts thousands of neutral pairs into readable ones.
2. **Widen the hate band.** 0.76% at |60|+ means the endgame between two
   survivors is usually between strangers. Vengeance already fires 11.7 times a
   run; it should move regard further than it does.
3. Add a `relationship band distribution` indicator to `test:metrics` with a
   goal of ≤60% neutral, so this is a number somebody watches.

## 4.2 Alliance roles are filled, but only four roles exist

96.5% of alliance samples of size ≥2 name at least one role — `AUDIT-4 §4.2` is
firmly closed. The fill rates:

| role | share of alliances ≥2 |
|---|---:|
| muscle | 96.5% |
| medic | 90.8% |
| scout | 48.1% |
| quartermaster | 46.8% |

The remaining problem is the roster, not the fill. Four roles, two of which are
nearly automatic, means "who are you in this group" has effectively two answers:
*are you the scout/quartermaster, or not*. Meanwhile the engine models a
**leader style** with exactly two values (democratic 2,859 / tyrant 525 —
15.5% tyrant), and eight charter rules that are drawn almost uniformly:

```
split-at-eight 833 · no-hunting-alone 723 · no-fighting 681
leader-decides-targets 676 · share-food 642 · share-intel 618
hold-the-camp 576 · no-looting-the-fallen 558
```

Uniform charter draw is a missed characterisation hook: a Career pack and a
group of frightened outer-district kids sign the same constitution.

**Fix:**
1. **Four more roles**, each read at exactly one existing site: `face` (speaks
   in `parley.ts` and `blocTreaty.ts` — currently `pickLeader`), `runner`
   (carries the cache in `contributeToCache`), `watch` (owns the night posting
   that `watchesPosted=78` already counts), `keeper` (holds debts in `debts.ts`).
2. **Bias the charter draw by composition**: leader archetype, mean caution,
   whether anyone is a Career. `leaderStyleOf` already exists and is read.
3. **A third leader style.** Two values for "how is this group run" is the same
   shape of problem as two useful roles. `absent` — a group with a nominal
   leader who does not decide — is the one the succession data is crying out
   for (`heirPassedOver=6`, `splitTheGroup=11` per 400 runs).

## 4.3 The bloc-treaty layer is a good system nobody can see working

Per 400 runs: treaties `brokenByAKilling=2`, `lapsed=6`, `endedByTheField=6`.
Fourteen endings in 400 runs is roughly one treaty per 29 runs — and the "sworn"
counter reads 0 for the reason in §1.2, so nobody has been able to tell whether
that is a low formation rate or a low survival rate.

The gate is strict and each clause is individually defensible:
`minBlocSize`, both speakers in the **same zone**, `minCrossRegard` across the
*whole* membership (and §4.1 says three quarters of that membership is at
neutral), then `baseChance + persuasion`. Composed, they are close to
impossible.

**Fix:** loosen exactly one clause — read `crossRegard` across the two
*speakers* plus the membership mean, rather than the full cross-product, so a
pack whose leaders get on can sign despite an indifferent rank and file. Then
restore the counter and measure.

## 4.4 Alliance politics is near-dead

Per 400 runs: `factionActions=13`, `hearings=7`, `coalitionFractures=9`,
`expulsions=130`. Expulsion works. Factions and hearings fire roughly once per
30 and once per 57 runs respectively — a player will typically never see a
hearing, and `alliancePolitics.ts` is 300 lines.

**Fix:** a hearing should be the *default* response to a charter breach rather
than an alternative to it. `charterBreaches=148` per 400 runs against
`hearings=7` says 95% of breaches skip the mechanic built for them.

## 4.5 Relationship systems that are working and should not be touched

Stated so a future pass does not "fix" them:

- Truce ledger fully accounted: `terms=670 endings=670 … unaccounted=0`.
- Loan ledger fully accounted: `made=329 accountedEndings=329 … unaccounted=0`.
- Vengeance ledger: `sworn=363 accountedEndings=360 … unaccounted=0`.
- `reconciliations=878`, `triangles formed=459`, `jealousyBeats=327`.
- Star-crossed at 17.7% of runs, down from 75.8%.
- `organicGroupsOf3Plus=1388` per 400 runs; alliance samples of ≥3 at 51.9%.

---

# §5 — Arena updates, robustness, more complexity

## 5.1 The authored arena layer is a lattice with visible holes

All 45 hand-authored arenas, across eleven authored columns:

| column | arenas with it | missing |
|---|---:|---|
| hand-authored signature | 45/45 | — |
| a law (or laws) | 45/45 | — |
| `edgeRules` | 45/45 | — |
| mutt roster | 45/45 | — |
| authored event pack | 45/45 | — |
| `effectVocab` | **34/45** | clockwork concrete saltflats canopy warren reef quarry floe seapeaks thresher vigil |
| `restockBias` | **22/45** | 23 arenas |
| `cornucopiaLayout` | **12/45** | 33 arenas |
| named `eventPack` set pieces | **11/45** | §5.2 |
| water source on ≥1 zone | **42/45** | frozen, warren, silkwood |
| vertical zones | 45/45 | — |

`effectVocab` is the cheapest of these and the most visible: it is how an arena
renames the six zone-effect primitives in its own words. Eleven arenas — including
`concrete`, `reef`, `quarry` and `floe`, all of which have obvious vocabulary —
print the engine's default nouns.

`cornucopiaLayout` is the starkest: 33 of 45 arenas use the default `plate`, so
the single most recognisable location in the game is shaped identically in
three quarters of them, despite `walled` and `island` both being implemented.

**Fix:** these are data rows. `effectVocab` for 11, `restockBias` for 23,
`cornucopiaLayout` for 33. Then add all three to `validate-arenas.ts` as
reported coverage lines, so the next arena cannot ship without them.

## 5.2 34 of 45 arenas share one identical Gamemaker intervention roster

`ARENA_EVENT_PACKS` contains 11 packs: `clockwork frozen concrete toxic solar
ashfall tidewrack thresher vigil saltworks kiln`. Each is **2 bespoke set pieces
+ 4 universal + the convergence = 7**. Every other arena resolves through
`?? UNIVERSAL_PACK` and gets **the same five**: The Resupply, The Front, The
Release, The Severance, The Convergence.

So a player who plays `menagerie`, `storywood`, `redcathedral`, `labyrinth`,
`carnival`, `glacier`, `alpine` and thirty more gets the identical arena-wide
intervention menu in all of them. The set-piece *kind* vocabulary is eight deep:

```
effectSweep 8 · severRoutes 5 · earlyCollapse 4 · revealAll 4
exposureSurge 3 · convergence 1 · muttRelease 1 · supplyDrop 1
```

and `effectSweep`, `earlyCollapse` and `revealAll` — twelve of the twenty-seven
authored set pieces, and the three most arena-shaped kinds — appear **only** in
the eleven bespoke packs. Thirty-four arenas can never produce any of them.

**Fix:** author two set pieces for each of the remaining 34 arenas. The kinds
already exist; this is 68 data rows in `arenaEventPacks.ts` and no engine work.
Prioritise by what the arena already declares: an arena with `effectVocab` has
already named its hazard and should get an `effectSweep`; an arena with heavy
`edgeRules` should get an `earlyCollapse` or a `severRoutes` variant.

## 5.3 A run shows ~12% of its arena's authored event pool

`soak.ts` reports 4.3 distinct authored events fired per run against a floor of
3.5, with per-arena pools of 33 (40 arenas) or 40 (the five newest). That is
**11–13% of the pool per run**. Cumulatively over 400 runs, `715/1611 (44.4%)`
fired at least once — and the soak's own comment correctly notes that this is a
function of runs-per-arena rather than of reach.

The thin tail is the finding:

```
thinnest per run:        procedural 0.3 (n=8) · eclipse 0.8 (n=9)
                         ashfall 1.2 (n=9) · frozen 1.3 (n=9) · saltworks 1.5 (n=8)
thinnest cumulative:     seapeaks 4/33 · eclipse 5/33 · frozen 6/33
                         ashfall 6/33 · thresher 7/40
```

**Procedural arenas fire 0.3 distinct authored events per run.** A procedural
run is the mode a player reaches for when they want novelty, and it is the mode
with the least authored content reaching the feed. `eclipse` at 0.8 and 5/33
cumulative means a player could play it four times and see five of its
thirty-three events.

**Fix:** the gate, not the pool. Audit the `minDay` / precondition set on the
thinnest arenas' events — `check-flavor-pools` counts them but nothing measures
how many are *reachable* given the median 8.5-day run. Add a "reachable within
the median run length" line to `check-flavor-pools`.

## 5.4 Zone-effect instances are lopsided

Live instances sampled per cycle across 400 runs:

```
fogbound 1510 · flooded 720 · burning 703 · stripped 685 · contaminated 466
blooming 304 · quaking 214 · swarming 162 · frozen 117 · irradiated 95
```

`irradiated` is no longer the dead one (`AUDIT-5` closed that), but `frozen` at
117 and `swarming` at 162 are now the floor, and `fogbound` alone is 30% of all
instances — more than the bottom five combined. Ten kinds, one of which is a
third of all occurrences.

**Fix:** `frozen` should be near-automatic in `glacier`, `floe`, `frozen`,
`cabin`, `seapeaks`; `swarming` in `sporefields`, `silkwood`, `menagerie`,
`canopyweb`. These are arena-declared `effectVocab` opportunities (§5.1) and the
two problems close together.

## 5.5 The arena map's mechanical vocabulary is broad and underused

103 edge rules exist across the roster: `tolled 28 · contested 25 · hidden 15 ·
collapsing 13 · timeGated 9 · oneWayAfter 8 · oneWay 5`. Measured per 400 runs:
`garrisonRuns=44 garrisonCycles=117 crossingsCounted=141 hiddenEdgesFound=67`.

Sixty-seven hidden edges found across 400 runs, from fifteen authored hidden
edges, is about one every six runs. `contested` (25 authored) produces 44
garrison runs. These are the two most interesting edge kinds and both are rare
enough that a player will not learn they exist.

**Fix:** raise the authored count for `hidden` and `contested` on the arenas
whose shape suits them (caves, ruins, urban), and surface both in the arena
briefing so the player knows to look.

## 5.6 Robustness, and what is already solid

- `validate-arenas` plays 17 stacked-law combinations to completion. That is
  genuinely strong coverage and should be extended to the off-season skins
  (§1.3) once they are reachable headlessly.
- `check-arena-layout` lays out 165 arenas with **0 label collisions** at every
  band up to 16 zones and a 46px zone target. No action.
- `check-zone-features` — every zone authors an interior. No action.
- 216 mutts across 52 rosters, every id and name unique. No action.

---

# §6 — Small and side features: updates, robustness, complexity

## 6.1 Off-season skins: 40 skins, 120 definitions, 0 test coverage

Stated in §1 as a bug (unreachable from every harness). Stated here as a
feature audit: this is one of the best replayability ideas in the repository —
an 18% chance that an arena arrives wearing a different season, which may lift
its law, impose another, and change yields and traversal cost — and it exists
only on the UI path.

It also has a coverage hole of its own: **the five newest arenas have no skins
at all** (`tidewrack`, `thresher`, `vigil`, `saltworks`, `kiln`), so 40 of 45
arenas have them and the newest five do not. Same shape as §5.1.

**Fix:** reachability first (§1.3), then three skins each for the five newest.

## 6.2 Legendary weapons work, and nothing tells the player

Across 300 runs: 2,391 weapons held at end, **705 had drawn blood**, **227 had
earned a `legendName`**, across **98 distinct names**. The system works — names
compose from the arena word, the zone word and the weapon noun, and the
`"Swamps's Answer"` bug from `AUDIT-4 §1.4` is fixed.

The gap is surfacing. A named weapon travels with the object — *"a weapon taken
off a body keeps the name it had when the body was holding it"* — which is a
lovely mechanic that the inventory UI renders as another line item.

**Fix:** a named weapon should be an event (it is), should appear on the tribute
sheet as a titled possession with its kill count, and should be a Panem record
("the most-blooded weapon in Panem's history"). Two of the three are one
component each.

## 6.3 Fieldcraft is set-and-forget

Per 400 runs:

```
trapsSet=598 · trapsTriggered=176 · fires=317 · shelters=856
camouflage=102 · poisonedWeapons=158
traps by kind: deadfall 223 · pit 211 · snare 105 · tripwire 53 · stake 6
```

Two findings. First, **29% of traps ever fire** — 598 set, 176 triggered — so
trap-setting is mostly a way to spend a cycle. Second, the kind distribution is
collapsed: `stake` fired **six times in 400 runs** and `tripwire` 53, against
deadfall's 223. Two of five trap kinds are statistically absent.

`trapsDestroyed=31` per 400 runs says the counter-play exists and is also rare.

**Fix:** (a) trap placement should read zone traffic — the engine knows
`chokepoint` on every zone and does not weight by it; (b) give `stake` and
`tripwire` a reason to be chosen (stake = damage, tripwire = *warning* rather
than damage, which nothing currently provides and which pairs with the
Patrolling stance from §3.1).

## 6.4 Rumours are the best-modelled side system and the least visible

```
true claims by kind: restock=37 · holed-up=283 · cache=82 · empty=73
planted=163 · exposedAsPlant=81 · exposedAsRepeated=46 · untraceable=47
```

A lie that can be traced back to its author, or not, is a genuinely deep
mechanic; `memory.zones[].hearsay` and `toldById` model belief separately from
truth. And the player cannot see any of it, because the UI shows the true map
(§3.4).

**Fix:** a "what they believe" overlay on the arena map for the watched tribute,
with hearsay zones marked. This is the single highest-value UI addition in this
report, because it makes an existing 200-line system legible for free.

## 6.5 Items: 58 objects, and the distribution is weapon-heavy

```
weapon 18 · utility 11 · food 9 · medical 7 · tool 6 · armour 4 · water 3
```

Eighteen weapons against three water items, in a game where dehydration is 4.7%
of deaths and the fourth-largest cause. `inventory: overloaded drops=801` per
400 runs says carrying capacity is a live constraint, which is good.

**Fix:** water and medical are the two categories the survival model actually
pressures and the two thinnest. Six more of each, with real differentiation
(a still, a filter with charges, a cauterising kit, an antivenom keyed to
`Venom-Wise`).

## 6.6 Side systems that are working

- Debts: `made=329 returned=179 defaulted=18`, ledger fully accounted.
- Mentors: `mentorCrossTalk=74` per 400 runs — thin, but the tiered
  parachute/withheld system reads well.
- Sponsor blocs, zone control (`held=524 payouts=94`), weather fronts (432),
  Gamemaker signatures (75). All live.
- `rng: empty pools handed to pickOrUndefined=0`. No action.

---

# §7 — More ways to die, and more events

## 7.1 The death table, measured

5,434 deaths across 300 runs, 434 distinct cause templates after normalising
names and numbers. By bucket at n=1,600:

| bucket | share |
|---|---:|
| another tribute | 59.4% |
| arena / hazard | 10.9% |
| bleeding | 5.6% |
| poison | 4.7% |
| dehydration | 4.7% |
| mutts | 3.9% |
| burns | 3.5% |
| infection | 2.9% |
| frostbite | 2.8% |
| starvation | 0.7% |
| border | 0.7% |

The top of the *template* table is what matters for variety:

```
10.99%  Killed by <name>
 5.85%  Killed by <name> while they lay unconscious
 5.36%  Killed by <name> (Trident)
 5.08%  Succumbed to poison
 4.27%  Died of dehydration
 4.03%  Torn apart by <name>
 3.90%  Killed by <name> (Bow and Arrows)
 …
 0.83%  Died of starvation
 0.79%  Caught in the front
 0.28%  Stepped off the plate before the gong
```

## 7.2 Universal deaths: 30 shapes, and the non-combat ones are thin

Normalising zone names out, 145 distinct death *shapes* exist across 540 runs;
**30 appear in 20 or more arenas** and are therefore universal. Of those 30,
**sixteen are `Killed by <name> (<weapon>)`** — the same death with a different
noun. The genuinely distinct universal non-combat deaths are:

```
Bled out from untreated wounds · Bled out from a wound <name> opened
Collapsed from exhaustion · Stepped off the plate before the gong
Driven into the force field as the border closed <zone>
Succumbed <zone> · Froze <zone> · Caught <zone> · Buried <zone>
Fell <zone> · Died <zone> · Torn apart by <name>
```

Twelve. A game with 11 proficiencies, 23 arena laws, 10 zone effects, an
infection model with sepsis, a resolve model with nightlock, and a fear model
has **twelve universal ways to die that are not a weapon**.

**Twelve universal deaths to add**, each off state the engine already keeps and
each requiring one write site:

1. **Drowned under load** — went into water over-capacity (`overloaded drops=801`
   proves the state exists).
2. **Died of thirst within reach of water** — dehydration death in a zone with
   `waterSource`, because they were too afraid to drink there (`fear` per-target).
3. **Killed by their own trap** — exists for `stake` only (`fieldcraft.ts:368`);
   generalise to all five kinds.
4. **Bled out holding somebody else's wound closed** — Nursing stance, ally
   lived (§3.1 gives Nursing a reason to exist).
5. **Went into shock** — composure floor plus a fresh deep wound.
6. **Drank what they knew was bad** — poison death where `forageFailures` in
   that zone ≥ 3.
7. **Never woke** — `noRest`/`deadlyNight` plus fatigue at floor. `vigil`
   already has "Did not wake for the watch"; make it universal.
8. **Crushed under their own shelter** — `shelters=856` and a `quaking` zone.
9. **Killed by the person they were protecting** — `protect` objective plus a
   betrayal.
10. **Starved holding a cache** — the alliance cache mechanic (`cacheContributions=1199`)
    with a charter rule forbidding the taking.
11. **Lost to the climb** — `climbing` proficiency failure on a vertical zone,
    distinct from the existing generic `Fell <zone>`.
12. **Took the nightlock for somebody else** — `nightlock=11` per 400 runs is one
    of the rarest and best beats in the game and has exactly one framing.

## 7.3 19 of 45 arenas produce no death that belongs to them

Stated in §5.2 in terms of set pieces. Stated here in terms of deaths, which is
the sharper measurement. Playing 12 runs of each of the 46 arena ids (45 authored + procedural) and classifying every
death shape as universal (≥20 arenas), shared (4–19) or **arena-owned** (≤3),
then stripping the generic border-collapse (`Crushed as <zone> closed`), generic
mutt (`Torn apart by <name>`) and generic weapon shapes:

| arena-owned death shapes | arenas | which |
|---:|---:|---|
| **0** | **19** | frozen, concrete, saltflats, sporefields, canopy, warren, abattoir, alpine, seapeaks, acousticforest, culdesac, kelvin, redcathedral, menagerie, storywood, cabin, karst, thresher, kiln |
| 1 | 13 (+ procedural) | toxic, solar, vault, eclipse, carnival, ashwaste, quarry, floe, terraces, craterfield, nooneplace, vigil, saltworks — and the procedural biomes |
| 2 | 10 | ashfall, islands, reef, glacier, canopyweb, labyrinth, ashgrove, silkwood, magmatube, tidewrack |
| 3 | 2 | clockwork, burnscar |
| 5 | 1 | tempest |

**Forty-two percent of the hand-authored arenas cannot kill you in a way that is
theirs.** `The Industrial Abattoir` — a rendering plant with a kill floor — has
zero. `The Menagerie`, with 13 zones and the largest mutt roster, has zero. The
five newest arenas, which got 40 events each instead of 33, are at zero (thresher,
kiln), one (vigil, saltworks) and two (tidewrack).

By contrast `tempest` has five (`Taken by the tide <zone>`, `Struck by
lightning`, `Drowned <zone>`, `Killed by <name> stake`, `Walked into the arena
border rather than keep playing`) and is unmistakable as a result.

**Fix: three arena-owned deaths per arena, as a shipping requirement.** Add a
line to `validate-arenas.ts` that fails an arena declaring fewer than two
death causes that reference its own vocabulary. Suggested per the worst
offenders:

- **abattoir** — the chain, the rendering vat, the stunner.
- **menagerie** — died in a habitat they could not read; taken by something on
  display; the keeper's door.
- **kelvin** — decompression; the airlock cycle; hypothermia in the cold store.
- **redcathedral** — fell from the nave; the rockfall in the slot; heat off the
  stone at night.
- **cabin** — the woodpile; the frozen well; the stove.
- **storywood** — the oven; the bramble; the bargain.
- **thresher / kiln** — both are industrial arenas whose only owned death is a
  border collapse. The machinery is right there in the zone names.

## 7.4 More events: universal

`UNIVERSAL_EVENTS` holds **88** authored universal events at a 30% draw share,
against 33–40 per arena. The universal set-piece roster is **four** (Resupply,
Front, Release, Severance) plus the convergence.

**Eight universal set pieces to add**, using kinds that already exist:

1. **The Reveal** (`revealAll`) — currently bespoke-only; it is the most
   generically useful kind in the file.
2. **The Drought** (`effectSweep` → `stripped`) — the horn is the only water.
3. **The Amnesty** — sponsors open to everyone for one cycle. Pairs with
   `noSponsors` arenas as its opposite.
4. **The Roll Call** — every tribute's kill count is broadcast; drives
   `targetDraw` for a cycle.
5. **The Curfew** (`earlyCollapse` at night only).
6. **The Bounty** — a named tribute's death pays the field. `notoriety` already
   ranks them.
7. **The Mercy** — one downed tribute is treated, chosen by audience
   excitement. The audience model exists.
8. **The Inventory** — every cache in the arena is announced.

## 7.5 More events: arena-specific

`check-flavor-pools` reports the arithmetic plainly: hard floor 24, soft target
40, **40 of 44 packs under the target, 277 events to go**. Thirty-nine arenas sit
at exactly 33 authored events with exactly 4 once-per-run and exactly 1 chain;
the five newest sit at 40 with 6–7 once-per-run and, still, exactly 1 chain.

**Every arena in the game has exactly one event chain.** That is the most
striking uniformity in the data: the chain is the only multi-beat authored
structure an arena has, and no arena has two.

**Fix:** (a) close the 277-event gap to the soft target; (b) require **three
chains** per arena, not one — a chain is the structure that makes an arena feel
authored rather than sampled; (c) raise once-per-run to 6 across the older 40
arenas, matching the newest five.

---

# §8 — Trait and archetype balancing

## 8.1 Archetype win rates have got worse, not better, and the sample is the reason

At n=1,600 runs (the run count `metrics.ts` itself says is required to judge
these lines):

```
whole-field spread (best/worst)   4.35x   (goal ≤ 2.3x)
best    career         10.54%  (n=3227)
worst   quartermaster   2.42%  (n=248)
```

`AUDIT-5` measured 2.94x at the same run count. This commit measures **4.35x**.
The guarded subset (archetypes with ≥500 entrants) reads 3.58x, also up from
3.01x at n=400.

The full table:

| archetype | n | win% | avg days | avg kills |
|---|---:|---:|---:|---:|
| career | 3227 | 10.54% | 4.66 | 1.18 |
| opportunist | 262 | 9.16% | 3.69 | 0.92 |
| zealot | 1011 | 6.53% | 3.08 | 0.73 |
| survivalist | 2794 | 5.83% | 3.99 | 0.48 |
| scavenger | 495 | 5.45% | 3.72 | 0.47 |
| confessor | 390 | 5.38% | 3.92 | 0.44 |
| trickster | 2616 | 5.16% | 3.24 | 0.62 |
| bellwether | 472 | 5.08% | 3.48 | 0.54 |
| medic | 972 | 4.84% | 3.87 | 0.49 |
| martyr | 210 | 4.76% | 3.22 | 0.43 |
| strategist | 2626 | 4.76% | 3.58 | 0.50 |
| wildcard | 2177 | 4.59% | 3.01 | 0.63 |
| diplomat | 975 | 4.51% | 3.92 | 0.49 |
| ghost | 1193 | 4.19% | 4.06 | 0.41 |
| mercenary | 1190 | 3.95% | 2.99 | 0.56 |
| scholar | 1112 | 3.78% | 3.43 | 0.38 |
| saboteur | 960 | 3.75% | 3.34 | 0.45 |
| beast | 711 | 3.66% | 2.86 | 0.74 |
| protector | 3104 | 3.64% | 3.74 | 0.50 |
| captor | 414 | 3.38% | 3.19 | 0.59 |
| underdog | 3059 | 2.94% | 3.51 | 0.39 |
| tracker | 306 | 2.94% | 3.28 | 0.63 |
| quartermaster | 248 | 2.42% | 3.93 | 0.40 |

**The entrant distribution is the real story.** Career draws 3,227 entrants;
martyr draws 210 — a **15:1 ratio**. Eight of twenty-three archetypes draw
fewer than 500 entrants across 1,600 complete Games, which `metrics.ts`
correctly refuses to judge. Two consequences:

1. **The spread is unmeasurable by design.** The best and worst rows are
   whichever rare archetype got lucky or unlucky, which is exactly why the
   number moved from 2.94x to 4.35x between audits without anything changing
   about the archetypes themselves.
2. **A player almost never sees eight of them.** At 24 tributes a run,
   quartermaster appears in roughly one run in six and martyr in one in twelve.
   Eight archetypes with full stance biases, objective biases, signatures,
   taglines and preferred traits are effectively bonus content.

**Fix, and this is the most important balance change in the report:**
**flatten the archetype draw.** If every archetype drew equally, each would see
~1,670 entrants at n=1,600 and every row above becomes judgeable. The current
skew is presumably deliberate (careers should be common) — keep a mild skew,
cap it at 3:1 rather than 15:1, and re-measure. Everything else in §8 is
guesswork until this number is trustworthy.

Secondary: **Career is still dominant on every axis at once** — best win rate,
longest survival (4.66 days vs a field around 3.5), and most kills (1.18 vs
~0.5). `targetDraw: 5` is the intended counterweight and is not enough.

## 8.2 Four archetypes still have no `targetDraw`, six no `fearScale`, six no `hatesArchetypes`

Static coverage across all 23:

| field | filled | missing |
|---|---:|---|
| `stanceBias` | 23/23 | — |
| `objectiveBias` | 23/23 | — |
| `targetPreference` | 23/23 | — |
| `riskCurve` | 23/23 | — |
| `signature` | 23/23 | — |
| `tagline` | 23/23 | — |
| `targetDraw` | **19/23** | strategist, trickster, wildcard, saboteur |
| `hatesArchetypes` | **17/23** | strategist, survivalist, trickster, medic, beast, scholar |
| `fearScale` | **17/23** | scavenger, captor, bellwether, quartermaster, opportunist, tracker |

`AUDIT-4 §8.3` closed `targetDraw` from 1/15 to 11/15 and it is now 19/23; four
remain, and all four are archetypes with an obvious reading (a saboteur the
field has caught at it should draw fire; a wildcard should not).

Separately: **`targetPreference` has five values and eight archetypes pick
`weakest`** — career, strategist, survivalist, medic, scholar, ghost, captor,
opportunist. `rival` has three, `nearest` four, `richest` five, `strongest`
three. "Goes for the weakest" is the default rather than a characterisation.

**Fix:** fill the thirteen missing cells; add two `targetPreference` values that
express something the current five cannot — `mostWounded` (opportunist, beast)
and `mostFamous` (mercenary, bellwether, tracker), both readable off state that
already exists.

## 8.3 Archetype signatures fire at wildly different rates

Share of entrants whose once-per-run set piece fired, at n=1,600:

```
survivalist 56.0% · career 53.3% · strategist 51.7% · protector 51.6%
underdog 51.6% · scholar 50.9% · diplomat 50.4% · martyr 46.2% · saboteur 45.5%
tracker 45.1% · trickster 45.0% · medic 44.4% · zealot 43.4% · scavenger 43.2%
wildcard 41.4% · beast 39.1% · ghost 38.6% · opportunist 36.6% · confessor 35.6%
mercenary 34.7% · bellwether 30.7% · captor 24.9% · quartermaster 23.8%
```

A 2.35x spread. The signature is described in `archetypes.ts` as *"most of what
makes an archetype memorable rather than merely statistical"*, and a
quartermaster's fires for one entrant in four. Combined with §8.1 —
quartermaster draws 248 entrants in 1,600 runs — a player sees the
quartermaster's signature roughly **once every twenty-seven Games**.

**Fix:** loosen the preconditions on the bottom five (captor, quartermaster,
bellwether, mercenary, confessor) until every archetype clears 40%, and add a
signature-fire-rate floor to `test:metrics`.

## 8.4 Reaping-trait balance: a 3.23x spread, with the same trait at the bottom as last audit

Among reaping-assigned traits with n ≥ 500 at n=1,600 (the only population that
can be balanced against itself, since earned traits are survivorship):

| hottest | win% | | coldest | win% |
|---|---:|---|---|---:|
| Brute | 9.21% | | Peacemaker | **2.85%** |
| Ruthless | 8.63% | | Kindler | 3.04% |
| Sunburnt | 7.87% | | Trapper | 3.29% |
| Bloodthirsty | 7.55% | | Insomniac | **3.29%** |
| Broker | 6.84% | | Fragile | 3.42% |
| Deep-Lunged | 6.72% | | Light Sleeper | 3.44% |

Spread **3.23x** (field mean ≈ 5.0%). `metrics.ts`'s own guarded figure is 3.43x
against a goal of ≤2.5x.

Two specific notes:

- **Insomniac is still 3.29%** despite the explicit fix recorded in `traits.ts`
  (*"the worst-designed trait in the file at 3.15% … paid back as the best
  night-watch in the game"*). The compensation (`awarenessNight: 2`) has moved
  it 0.14 points. `fatigueNight: 10` is simply larger than any awareness bonus
  can repay in an 8.5-day run.
- **Peacemaker (2.85%) and Kindler (3.04%)** are now the floor. Both are
  "do a social/utility thing" traits in a game where 59.4% of deaths are dealt
  by another tribute.

Also worth stating: the four hottest are all combat traits, and the trait power
census flags `Hardened 3.45 sd` and `Unremarkable 2.92 sd` as hot in the combat
category while `Contrarian 0.40` and `Oathbound 0.35` are cold in social.

**Fix:**
1. **Insomniac**: cut `fatigueNight` to 5 and add `awarenessNight: 3` plus a
   real upside — an Insomniac should be immune to being ambushed while their
   group sleeps. That is a mechanic, not a modifier.
2. **Peacemaker**: give it a hook that pays in a fight — a Peacemaker who has
   brokered a truce with someone should get a one-time refusal from them.
   `parley.ts` already tracks `brokeredHeld=63`.
3. **Kindler**: `fireImpossible` arenas exist; on every other map, fire should
   be worth more than it is (`fires=317` per 400 runs is low).
4. Add a per-trait win-rate floor to `test:metrics` at n≥500, guarded at 3.0%.

## 8.5 District legacy is a 3.2x handicap, and two districts are unwinnable

Win rate by legacy tier at n=1,600:

```
strong      9.5%  (3,200 entrants)
storied     8.8%  (6,400)
modest      3.8%  (4,018)
forgotten   3.6%  (6,472)
thin        3.0%  (10,434)
```

And by district:

```
D1 17.3% · D2 18.7% · D4 19.5% · D3 5.6% · D5 6.4% · D6 6.5% · D7 5.6%
D8 4.6% · D9 3.8% · D10 3.1% · D11 4.2% · D12 4.5% · D13 0.2% · D16 0.1%
```

The Career districts at 55.4% combined is the intended shape and clears its
guard. **D13 at 0.2% and D16 at 0.1% are not.** Three victors and one victor
respectively out of 1,559. Both districts have full name pools (16 districts,
3,584 names) and mentor pools, and a player who draws them has effectively no
run.

**Fix:** D13 and D16 need a legacy profile that is *different* rather than
merely worse — D13's whole premise is that it was supposed to be gone. Give it
a `LEGACY_EFFECTS` row that trades reputation for something (sponsor
indifference, but a starting proficiency, or immunity to the `forgotten`
training-merit penalty).

---

# §9 — Replayability and staleness

Everything here is additional to §5, §7, §8 and §10 rather than a restatement.

## 9.1 The run is short, and the variance is in the wrong place

`avgDays=6.3` in the soak (which sweeps 2- and 3-district fields) and `8.5` in
metrics. Run-length standard deviation is **2.18 days**, which *meets* its goal
of ≥2.0.

The shape underneath is the problem: **35.4% of the field dies in the
bloodbath**, and the victor averages 2.56 kills. So a typical run is one large
opening slaughter, then eight days during which twelve people mostly do not meet.
The `Evasive` stance at 37.2% (§3.1) is the same fact from the other side.

**Fix:** this is what the convergence is for, and it fires at ≤6 alive. Add a
second, softer convergence at ~12 alive — a *reason* to meet rather than a
forced merge. `zoneControl` payouts and `theBell` are both the right shape.

## 9.2 Quells are rarer than they read

13.3% of runs carry a Quell, and 22 of 28 Quells appeared across 300 runs. A
player who plays ten runs sees one Quell. Quells are the single loudest
"this run is different" lever in the game and they fire in one run in eight.

Temperaments and cast shapes are better distributed — all 9 temperaments and all
8 cast shapes appeared in 300 runs — though `victors-field` appeared **twice**
and `career-heavy` fourteen times against `ordinary`'s 109.

**Fix:** raise the Quell rate to ~25%, and floor the rarest cast shapes. A cast
shape seen twice in 300 runs is authored content nobody meets.

## 9.3 Nothing in the game changes between your first run and your hundredth

`panemStorage` tracks runs, victors, unlocked arenas, bests, district crowns and
Quells seen. The only progression that changes a *run* is arena unlocking, and
`SetupScreen` deliberately collapses the locked set to one line.

There is no reason for run 40 to feel different from run 4 except which arena
you pick. Meanwhile the repository already stores exactly the material a
progression layer needs.

**Fix, in ascending cost:**
1. **A Panem calendar.** Consecutive runs form a *year*; the Quell cadence, the
   head Gamemaker (20 exist, all seen) and the Capitol's temperament persist
   across a few runs instead of re-rolling every time.
2. **Victors persist.** `veterans.ts` and the `victors-field` cast shape exist.
   A victor from run 12 mentoring in run 13 is nearly free and is the single
   strongest anti-staleness hook available.
3. **District standing accumulates.** `districtCrowns` is stored and unread by
   the engine.

## 9.4 The daily seed and mutators are the best replay hooks and are under-surfaced

`replayHooks.ts` provides `dailySeed()`, `featuredArena()` and `MUTATORS`. The
setup screen exposes "Play the daily" and a facet filter (`All / New to you /
2+ laws / No sponsors / Watery / Small / Large / Surprise me within this`),
which is genuinely good design.

What is missing is *result* persistence: a daily seed with no shared scoreboard
and no record of yesterday's is a button, not a mode.

**Fix:** store the last 30 dailies with their outcome in `panemStorage`, and
show a strip. The storage layer is already migration-tested.

## 9.5 The procedural arenas are the weakest replay surface

Restated from §5.3 in replayability terms, because it is the mode that exists
*for* replayability: **procedural runs fire 0.3 distinct authored events per
run** — the thinnest of all 46 arena ids, against a floor of 3.5 for the roster
as a whole. `validate-arenas` confirms every biome *composes* ≥16 authored
events, ≥2 once-per-run, a chain and ≥8 ambient lines. They compose and they do
not fire.

**Fix:** treat this as the highest-priority number in §5. A player who wants
something new gets the emptiest feed in the game.

---

# §10 — Shallow, incomplete, or thin features; names and flavour

## 10.1 Epithets: seven kinds, one of which is 69% of all awards

Across 300 runs and 5,728 tributes, **504 epithets were awarded (8.8%)**:

| kind | awards | share of awards |
|---|---:|---:|
| bloody | 346 | 68.7% |
| turncoat | 66 | 13.1% |
| enduring | 63 | 12.5% |
| merciful | 14 | 2.8% |
| warden | 10 | 2.0% |
| unseen | 5 | 1.0% |
| builder | 0 | 0% |

`builder` — the trap-kill epithet — was **never awarded in 300 runs**, which is
consistent with `trapsTriggered=176` per 400 runs (§6.3).

The cause is structural and visible in `epithets.ts`: awards are checked in a
fixed priority order, blood first, one per tribute ever. Any tribute with enough
kills takes `bloody` and can never earn any of the other six. So six kinds
compete for the 31% of awards that go to tributes who did not kill much.

**Fix:** (a) score all seven and award the *highest-scoring* rather than the
first match; (b) drop `killsForBloody` so it is genuinely a high bar rather than
a catch-all; (c) lower `trapKillsForBuilder` to 1 and fix trap trigger rates.
Also: epithets are explicitly non-mechanical, which is a defensible choice, but
`notoriety` and `targetDraw` both exist and an epithet is precisely the moment
the field decides about somebody.

## 10.2 Achievement rarity labels are wrong 13 times and the tiers are lopsided

207 achievements. By label: `rare 95 · legendary 61 · common 47 · possible 4`.
**Four** achievements carry the `possible` tier. A four-tier system with one tier
at 1.9% is a three-tier system with a typo.

Thirteen labels contradict the measured rate over 500 runs:

| id | labelled | measured |
|---|---|---:|
| under-two-suns | rare | 37.0% |
| sole-of-two | common | 24.6% |
| the-tally | common | 24.6% |
| arena-wins | common | 23.8% |
| eleven-score | common | 16.4% |
| found-first | legendary | 7.6% |
| the-youngest | legendary | 6.2% |
| the-perimeter | common | 5.6% |
| on-retainer | rare | 2.8% |
| the-tended | rare | 2.0% |
| twelve-score | rare | 1.6% |
| four-skills | rare | 1.4% |
| the-short-week | possible | 0.2% |

`npm run fix:rarity` exists (`ACHIEVEMENT_EMIT_RARITY=1`). It has not been run
since these drifted.

**Fix:** run `fix:rarity`, then make `check-achievements` **fail** on a
contradiction rather than reporting it; and rebalance the tiers so `possible`
carries a real share.

## 10.3 Flavour pools: the thinnest are the most-drawn

`check-flavor-pools` measures pool depth against measured draws per run, which
is the right metric. The four tightest:

```
SANITY_TEXTS.ruinStealth      20 lines / 11.7 draws  (1.7x)
SPONSOR_TEXTS                 31 lines / 16.1 draws  (1.9x)
VENGEANCE_TEXTS               24 lines / 12.3 draws  (2.0x)
SANITY_TEXTS.hallucination    20 lines / 8.0 draws   (2.5x)
```

At 1.7x, a single run draws `ruinStealth` 11.7 times from a pool of 20 — so a
player reads well over half the pool **in one run**, and every subsequent run
repeats it. Meanwhile `AMBIENT_TEXTS` sits at 15.0x and `RELIEF_TEXTS` at 13.8x.

Sanity is also 11.64% of all feed lines (§2.4), so this is the pool a player
sees most and the one that runs out first.

**Fix:** triple `SANITY_TEXTS.ruinStealth`, `SPONSOR_TEXTS` and
`VENGEANCE_TEXTS` (to roughly 60, 90 and 72). Add a hard check floor at 4x
draws-per-run rather than a fixed line count — the current floors are absolute
and the problem is relative.

## 10.4 Interview personas: 18 authored, 15+15 scenarios each, all before the gong

The interview layer is unusually well stocked: 18 personas, each with 15 success
and 15 failure scenarios, plus `CAESAR_QUESTIONS`, `CAESAR_FOLLOWUPS`,
`INTERVIEW_CLOSERS`, `PERSONA_DRIFT`, `PERSONA_THREAT`. `interview` lines are
10.21% of the whole chronicle.

The shallowness is that a persona is a costume worn for one phase. `PERSONA_DRIFT`
and `PERSONA_THREAT` exist; what does not exist is a persona *failing in the
arena* — the Charming Flirt who cannot make anyone like them, the Silent Threat
nobody is afraid of. `persona.ts` is 100 lines against `personas.ts`'s content
mass.

**Fix:** carry the persona into the arena as a two-way bet. A tribute who sold a
persona and then contradicts it should lose sponsor trust; one who lives up to it
should gain. `sponsorTrust` is already a per-cycle drift.

## 10.5 Names and flavour breadth: the inventory

| roster | count | notes |
|---|---:|---|
| tribute names | **3,584** | 16 districts × 2 genders, 251 in two pools, none in three |
| mentor names | **204** | 16 districts, ≥12 deep each, none shared |
| neutral names | authored | for the no-gender cast option |
| traits | **95** | 76 rollable + 19 earned |
| quirks | **105** | all 105 seen in 300 runs; all carry `QUIRK_MODS` |
| archetypes | **23** | 8 under 500 entrants at n=1,600 |
| arenas | **45** | + procedural biomes |
| mutts | **216** | across 52 rosters |
| items | **58** | 18 weapon / 11 utility / 9 food / 7 medical / 6 tool / 4 armour / 3 water |
| achievements | **207** | 10 never unlock |
| interview personas | **18** | 15+15 scenarios each |
| head Gamemakers | **20** | all 20 seen in 300 runs |
| Quells | **28** | 22 seen in 300 runs |
| temperaments | **9** | all seen |
| cast shapes | **8** | all seen; `victors-field` twice in 300 |
| off-season skins | **120** across 40 arenas | **0 reachable headlessly** |
| epithet kinds | **7** | one is 69% of awards |
| alliance roles | **4** | two near-automatic |
| charter rules | **8** | drawn near-uniformly |
| arena laws | **23** | |
| zone effects | **10** | one is 30% of instances |
| edge-rule kinds | **7** | |
| set-piece kinds | **8** | 3 reachable in only 11 arenas |
| stances | **10** | 5 under 3% |
| objectives | **8** | 3 under 3% |
| proficiencies | **11** | mean best 2.83 of 6 |
| terrains | **10** | |
| weapon classes | **3** | |

**The initial-letter distribution of names is 9.6:1** (S: 356 names, X: 37).
That is a legible in-fiction fact rather than a fault — Panem names cluster —
but it means a 24-tribute cast disproportionately reads as S-, C- and A-names.

**Flavour types that do not exist and should** (§10 asks for more *types*, not
more rows):

1. **Weapon classes: three.** `melee`, `ranged`, `thrown`. No `polearm` (reach,
   bad indoors), no `shield` (armour exists as a property, not a class), no
   `improvised` (breaks on use, everywhere, free).
2. **Terrains: ten, and no `sky`/`canopy` despite two canopy arenas**, no
   `industrial` despite four.
3. **No tribute *background* axis.** Age and district exist; there is no "what
   did you do before" — a miner, a weaver, a butcher's child. Districts imply
   it (`DISTRICT_CRAFT` exists!) and nothing personalises within a district.
4. **No token / keepsake type.** `DISTRICT_TOKENS` exists as flavour and is not
   an object; the source material's single most-remembered prop is a pin.

---

# §11 — More achievements, and more names

## 11.1 The achievement roster, measured

207 entries over 500 completed runs:

| category | count | never unlock | near-automatic |
|---|---:|---:|---:|
| social | 51 | | |
| arena | 30 | | |
| survival | 26 | | |
| capitol | 23 | | |
| combat | 21 | | |
| oddity | 19 | | |
| games | 19 | | |
| reaping | 18 | | |
| **total** | **207** | **10** | **7** |

121 of 207 sit in the usable 5%–60% band, which is a good ratio. 90 numeric
tests all carry a `nearMiss`, none exempt.

## 11.2 The 10 that never unlock

```
reflection-survivor   possible     nothing-but-hands  legendary
every-door            possible     grey-market        legendary
the-quiet-one         legendary    the-unwitnessed    legendary
careers-early         legendary    every-persona      legendary
twelve-levers         possible     even-field         rare
```

Three of these are `possible` tier — which is meant to be the *achievable*
tier — and one (`the-short-week`) is labelled `possible` and measured at 0.2%.
`every-persona` cannot fire while a persona is a one-phase costume (§10.4).
`twelve-levers` and `every-door` are completionist conditions across systems
that do not all fire in one run (§5.3, §9.5).

**Fix:** each of the ten needs a decision — either make it reachable (loosen the
predicate), re-tier it as legendary, or delete it. A permanently unreachable
achievement in a visible list is a bug the player can see.

## 11.3 The 7 that are near-automatic

```
outlived-the-map 87.2% · made-them-blink 75.8% · kept-word 65.6%
changed-by-it 64.8% · named-early 62.0% · someone-elses-war 60.8%
nobody-came 60.0%
```

Seven achievements that fire in three runs out of five are participation
trophies. Raise each threshold until it lands in the 20–40% band.

## 11.4 Sixty achievements to add

Grouped by category, each keyed to state the engine already records. None
require new engine work.

**Reaping (6)** — `the-sixteenth` (a D16 tribute survives day one);
`both-from-thirteen`; `the-oldest-field` (mean age ≥17); `no-volunteers` (a run
with zero volunteers); `all-twelve-represented-at-the-feast`;
`reaped-and-ready` (a tribute with 3+ preferred traits for their archetype).

**Combat (7)** — `never-drew` (victor whose weapon never had `bloodDrawn`);
`the-named-blade` (win holding a weapon with a `legendName`);
`inherited` (win with a weapon taken from someone who took it from someone);
`bare-handed-kill`; `three-in-a-cycle`; `killed-by-your-own` (a trap kill on its
setter, once §6.3 lands); `the-unarmed-pack` (an alliance of 3+ with no weapons
at nightfall).

**Survival (8)** — `never-slept-indoors`; `no-fire-all-week`;
`sepsis-survivor` (an infection reaches terminal and is treated);
`drank-from-ten-sources`; `every-vital-below-twenty-at-once-and-lived`;
`the-long-fast` (5 days without food); `frostbitten-and-standing`;
`nightlock-refused` (hit the resolve floor and did not take it).

**Social (10)** — `the-treaty-year` (a bloc treaty survives to the final six —
currently near-impossible, see §4.3); `every-role` (an alliance that fills all
four roles at once, eight once §4.2 lands); `the-hearing` (win a charter
hearing); `the-tyrant` (a tyrant-led alliance of 4+ survives to day 6);
`three-truces-held`; `paid-every-debt`; `the-heir` (a named heir inherits and
wins); `lied-and-was-never-caught` (planted a rumour, `untraceable`);
`reconciled-with-your-betrayer`; `the-whole-field-neutral` (no relationship
outside ±20 at the end of day 2).

**Arena (9)** — `found-the-hidden-way` (cross a `hidden` edge);
`paid-every-toll`; `the-severed` (survive a `severRoutes` set piece split from
your alliance); `every-zone-effect` (witness all ten in one run);
`stood-in-the-bell` (`theBell` law, three mornings); `the-garrison` (hold a
`contested` edge two cycles); `walked-the-whole-map`; `off-season` (play a
skinned arena, once §1.3 lands); `the-vertical` (change level in a vertical zone
under fire).

**Capitol (6)** — `no-sponsor-ever`; `the-retainer` (three gifts from one
bloc); `refused-a-gift`; `twelve-score-and-survived`; `every-gamemaker` (meta:
see all 20 head Gamemakers across runs); `the-quell-double` (win two Quell runs
back to back).

**Games (7)** — `the-calendar` (a run where both a signature beat and a calendar
beat fire on the same cycle); `no-bloodbath` (under 15% of the field dies at the
horn); `the-fifteen-day` (a run past day 14); `dual-victory`; `the-wipeout`;
`every-temperament` (meta, across runs); `the-daily-streak` (three dailies in a
row).

**Oddity (7)** — `all-four-traps` (set one of each kind);
`the-named-weapon-changed-hands-three-times`; `epithet-not-bloody` (earn any of
the other six, which §10.1 makes possible); `outlived-your-killer`;
`zero-travel` (a victor who never left their opening zone);
`the-ten-proficiency` (reach cap in any axis); `heard-your-own-rumour` (a
planted rumour comes back to its author as hearsay).

## 11.5 Names: the state of the pools, and what to add

`check-names` on this commit:

```
3,584 names across 16 districts; 251 appear in more than one pool, none in more than 2.
initial-letter spread now 9.6:1 (S 356 down to X 37).
204 mentors across 16 districts; every pool at least 12 deep, none shared.
no themed names have wandered out of the district they belong to.
```

**There are no surnames, there is no surname pool, and this is enforced.**
`names.ts:517` states it — *"There are no surnames in this game and there is no
pool for them"* — and `check-names.ts:70` and `:91` fail any entry that reads as
a surname or a compound. `generator.ts:257` and `:333` record the removal.
**Nothing in this report proposes adding one, and §11.6 below is written to keep
the guard green.**

## 11.6 Two hundred names to add, no surnames

Distribution is deliberate: it corrects the 9.6:1 initial-letter skew, fills the
two thinnest mentor pools, and adds nothing that could parse as a family name.

**Per-district, 10 each (5 Male, 5 Female), 160 total.** Keeping each district's
existing formation rules — literal nouns, phonetic twists of the industry word,
and real names that echo the theme:

- **D1 (luxury)** — M: `Brocade`, `Lustrine`, `Orfèvre`, `Tessellate`, `Wrought`;
  F: `Xanthine`, `Quillon`, `Nacrissa`, `Verdigris`, `Yardley`.
- **D2 (masonry)** — M: `Xanthus`, `Quarrel`, `Keystone`, `Voussoir`, `Jamb`;
  F: `Ashlar`, `Xanthe`, `Quoin`, `Dentil`, `Kerf`.
- **D3 (technology)** — M: `Xenon`, `Kelvinor`, `Quantic`, `Jitter`, `Verilog`;
  F: `Yotta`, `Xylia`, `Quanta`, `Nibble`, `Kibi`.
- **D4 (fishing)** — M: `Xebeck`, `Quarterdeck`, `Yawl`, `Kedge`, `Vang`;
  F: `Xiphia`, `Quayle`, `Yarrow`, `Nerissa`, `Kelpie`.
- **D5 (power)** — M: `Xantho`, `Quench`, `Yoke`, `Kilowatt`, `Vane`;
  F: `Xandra`, `Quiescent`, `Yield`, `Nernst`, `Kilne`.
- **D6 (transport)** — M: `Xander`, `Quay`, `Yardarm`, `Klaxonis`, `Vector`;
  F: `Xenia`, `Quartermile`, `Yarder`, `Nacelle`, `Kerbside`.
- **D7 (lumber)** — M: `Xylan`, `Quirt`, `Yewell`, `Knothole`, `Veneer`;
  F: `Xylona`, `Quaking`, `Yewlin`, `Nurselog`, `Kindling`.
- **D8 (textiles)** — M: `Xander`, `Quilt`, `Yarnwell`, `Kersey`, `Velvetine`;
  F: `Xanthea`, `Quiltrey`, `Yarnly`, `Nankeen`, `Kashmir`.
- **D9 (grain)** — M: `Xerophyte`, `Quern`, `Yeoman`, `Kernel`, `Vetch`;
  F: `Xanthea`, `Quinoa`, `Yeasty`, `Nixtamal`, `Kamut`.
- **D10 (livestock)** — M: `Xerxes`, `Quirtley`, `Yearling`, `Kine`, `Vealwell`;
  F: `Xanthia`, `Quirte`, `Yearlynn`, `Nannette`, `Kidling`.
- **D11 (agriculture)** — M: `Xerant`, `Quince`, `Yarrowin`, `Kale`, `Vernal`;
  F: `Xylema`, `Quinceta`, `Yarrowyn`, `Nectarine`, `Kumquat`.
- **D12 (mining)** — M: `Xanthite`, `Quartzon`, `Yieldshaft`, `Kerogen`,
  `Vein`; F: `Xanthea`, `Quarrel`, `Yieldra`, `Nubbin`, `Kohl`.
- **D13 (nuclear/graphite)** — M: `Xenolith`, `Quell`, `Yellowcake`, `Kelvinite`,
  `Voidwell`; F: `Xenia`, `Quietus`, `Yttria`, `Nuclide`, `Kiloton`.
- **D14 (stone, post-D2)** — M: `Xystus`, `Quadrel`, `Yardstone`, `Kerbwell`,
  `Verge`; F: `Xanthica`, `Quadra`, `Yardley`, `Nogging`, `Kerb`.
- **D15** — M: `Xanthic`, `Quiver`, `Yielder`, `Kenner`, `Vellum`;
  F: `Xanthippe`, `Quire`, `Yielda`, `Nib`, `Kalamos`.
- **D16** — M: `Xerica`, `Quorum`, `Yondar`, `Kestrelin`, `Vantage`;
  F: `Xerica`, `Quorra`, `Yonda`, `Nimbus`, `Kestrel`.

**Neutral pool, 20 more** for the no-gender cast option: `Ash`, `Bramble`,
`Cinder`, `Drift`, `Ember`, `Fallow`, `Glim`, `Hollow`, `Ivy`, `Juniper`,
`Kestrel`, `Lark`, `Marrow`, `Nettle`, `Oakum`, `Pike`, `Quill`, `Rill`,
`Sedge`, `Thatch`.

**Mentors, 20 more** (the two thinnest pools plus a spread): keep the existing
convention of a single given name per mentor and no shared entries between
districts.

**Every entry above is a single given name.** None contain a space, a hyphen, or
a patronymic. `check-names` should stay green; run `npm run test:names` after
adding and confirm the initial-letter spread falls below 9.6:1 (the heavy X/Q/Y
weighting above is chosen precisely to move it).

---

# §12 — More traits, skills, archetypes

## 12.1 The current shape

95 traits (76 rollable, 19 earned), 23 archetypes, 11 proficiencies, 105 quirks.
All 95 traits and all 105 quirks were seen in a 300-run sweep, so nothing is
unreachable. Every quirk carries a `QUIRK_MODS` row — `AUDIT-4 §6.3` is closed.

The `TraitMod` vocabulary is 52 keys. Counted by what they touch:

- **combat and body:** ~26 keys
- **survival and deprivation:** ~12
- **movement:** 3
- **social:** 8 (`allianceAffinity`, `betrayalResist`, `treachery`,
  `griefResist`, `persuasion`, `rapport`, plus `sponsorTrust`, `excitement`)
- **items:** 2

`AUDIT-5 §8.3` added `persuasion` and `rapport` to address exactly this and the
ratio is still roughly 3:1 combat-to-social, in a game whose deepest subsystem is
social. That is the single structural gap in the trait layer.

## 12.2 Eight new `TraitMod` keys, each read at one site

1. `trustGain` — scales how fast `adjustTrust` moves. (`relationships.ts`)
2. `suspicionResist` — fraction removed from `raiseSuspicion`. (`memory.ts`)
3. `leadership` — added to `pickLeader`'s score. (`alliance.ts`)
4. `charterHold` — reduces `noteBreach` chance. (`alliancePolitics.ts`)
5. `rumourCredibility` — how much a claim from this tribute is believed.
   (`rumours.ts`)
6. `debtHonour` — repayment likelihood. (`debts.ts`)
7. `intimidation` — the eleventh proficiency exists; nothing modifies it.
   (`fear.ts`)
8. `haggle` — parley outcomes. (`parley.ts`)

## 12.3 Twenty-four new traits

**Social (10)** — the category that needs them most.

| trait | effect |
|---|---|
| `Vouched` | Somebody in the field already trusts them. `trustGain +0.3`, `allianceAffinity +0.1` |
| `Stone-Faced` | Cannot be read. `suspicionResist 0.4`, `rapport −0.2` |
| `Standard-Bearer` | `leadership +2`, `targetDraw +1` — people follow them and the field knows who to remove |
| `Bookkeeper` | `debtHonour +0.4`, `charterHold +0.3` |
| `Fabulist` | `rumourCredibility +0.3` and a higher `planted` rate — believed whether or not they should be |
| `Quiet Room` | `persuasion +1.5` but only outside combat |
| `Sworn Off` | Refuses every alliance for the first three cycles. `allianceAffinity −0.5` early, `+0.3` after |
| `Tallyman` | Remembers every slight. `betrayalResist 0.3`, `griefResist −0.2` |
| `Open Hand` | `rapport +0.4`, `treachery −0.3`, `capacity −1` — they give things away |
| `Hard Bargain` | `haggle +0.4`, `sponsorAppeal −0.5` |

**Body and survival (6)** — `Thin-Blooded` (`bleedResist −0.3`, `coldResist
+0.4`); `Deep-Rooted` (immune to depletion penalties in one zone);
`Sun-Blind` (`awareness −1` by day, `awarenessNight +3`); `Gut-Wise`
(`poisonResist 0.4`, `forage +0.15`, `hungerDrain +3`); `Second Wind`
(one free recovery from exhaustion per run); `Salt-Cured` (`thirstDrain +4`,
`heatResist 0.5`).

**Combat (4)** — `Left-Handed` (`meleePower +2` on first exchange only);
`Shield-Wise` (doubles `armour` values); `Reach` (`meleePower +3` with a
polearm class, §10.5); `Cold Opener` (`ambush +0.25`, `retreat −0.2`).

**Earned (4)** — `Oath-Breaker` (earned breaking a charter: `treachery +0.3`,
`allianceAffinity −0.4`); `Fire-Walker` (earned surviving a `burning` zone twice:
`burnResist 0.5`); `Twice-Downed` (earned surviving two downs: `retreat +0.3`,
`combatPower +1`); `Namesake` (earned holding a `legendName` weapon to a second
kill: `sponsorAppeal +2`, `targetDraw +1`).

## 12.4 Four new proficiencies

`butchery` (field-dressing a corpse for food — pairs with `Butcher`, `Vulture`
and the `salvage` law); `navigation` (reduces the cost of long routes and
unlocks `hidden` edges — the counterpart to §5.5); `carpentry` (splits from
`crafting`: shelters and traps, where `crafting` keeps repair); `oratory`
(splits from `persuasion`: addressing a *group*, where `persuasion` is
one-to-one, which is exactly the gap §4.3's bloc treaties fall into).

## 12.5 Six new archetypes

Chosen to fill holes the current 23 do not cover, and specified in the full
`ArchetypeDef` shape so each ships complete (§8.2 shows what happens when they
do not).

| id | the hole it fills | sketch |
|---|---|---|
| `herald` | Nobody's role is *information*. | `targetPreference: 'mostFamous'`, `objectiveBias: { stalk: +0.4, wait: +0.3 }`, `riskCurve: 'flat'`, `targetDraw: −1`, signature `heraldBroadcast`. Feeds §3.2's dead `wait`. |
| `warden` | Nobody is built to hold ground. | `stanceBias: { Fortified: +0.5, Patrolling: +0.5 }`, `objectiveBias: { hold: +0.5 }`, `targetDraw: +1`, `riskCurve: 'escalating'`. Feeds §3.1's two deadest stances. |
| `penitent` | Nobody's arc is *away* from violence. | Starts `aggression +0.3`, drifts negative with each kill; `killSanity` doubled; signature `penitentConfession`. The trait-arc engine (`pacifistToBroken=55`) has no archetype that runs it backwards. |
| `forager` | `survivalist` is defensive; nobody is *acquisitive* about the ground. | `objectiveBias: { reach: +0.4 }`, `forage` and `campSkill` head starts, `targetDraw: −1.5`. |
| `duellist` | `career` and `beast` are the only aggressive builds and both are pack-shaped. | `targetPreference: 'strongest'`, refuses group combat, `retreat −0.3`, `riskCurve: 'late-blooming'`, signature `duellistCall`. |
| `broker` | `diplomat` makes peace; nobody *sells*. | `targetPreference: 'richest'`, `haggle` head start (§12.2), `objectiveBias: { wait: +0.3 }`, signature `brokerPrice`. |

**A condition on all six**, and it is the reason §8.1 is the most important
finding in this report: **do not add an archetype until the draw distribution is
flattened.** Adding six more to a roster where eight of twenty-three already draw
under 500 entrants in 1,600 runs makes the balance table less measurable, not
more — and makes it likelier that a player never meets any of them.

---

## Priority

If only five things are done from this report:

1. **§1.1** — repair `test:ui` and put it in CI. 13,288 lines of interface have
   no coverage, and the harness that should provide it is 52% red.
2. **§8.1** — flatten the archetype draw from 15:1 to ~3:1. Until this lands, no
   archetype balance number in the repository is trustworthy.
3. **§7.3 / §5.2** — three arena-owned deaths and two arena-owned set pieces per
   arena. Nineteen arenas cannot currently kill you in a way that is theirs and
   thirty-four share one intervention menu.
4. **§1.3** — make the off-season skins reachable from the headless harness.
   120 balance-affecting definitions are untested.
5. **§2.2** — a real DOM tap-target floor. 155 of 168 controls fail WCAG 2.5.8
   at phone width, on a build that tests its SVG map at 44px.
