# Changelog

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
