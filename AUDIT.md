# Survival Games — full audit report (11 sections)

## Context

`icamcmusic-ship-it/survival-games` is a ~92k-line React 19 + TS Hunger-Games
tribute simulator: 78 engine modules, 40 hand-authored arenas (415 zones), 1,323
arena events, 62 traits, 15 archetypes, 158 achievements, 12 CI check scripts.
Several prior audit passes are documented in `README.md` and `CHANGELOG.md` and
**nothing already done there is re-reported below.**

This is a standing audit across eleven areas, each kept as its own section:
bugs, QOL/UI/UX, tribute logic, relationships and alliances, arenas, side
features, deaths and events, trait and archetype balance, replayability, shallow
mechanics and flavour breadth, and achievements and names. Every claim cites
`file:line` against the tree at the commit that added this file. The §1 bugs are
fixed in the commit that follows; §2–§11 are sized here and left to prioritise.

The headline finding, which recurs in §5, §7, §10 and §11: **this codebase's
guards have become its content spec.** Arena event packs are 33 or 34 in all 40
arenas; extras are exactly 9 in all 40; quirks are exactly 4 lines in all 85;
names are exactly 100 per district per gender in all 32 pools; conditional-stance
pools are exactly 4 wherever authored — against a 12-entry fallback they replace,
so authoring one makes the game *worse*. Every one of those numbers is a
threshold, not a content decision. The second recurring finding: **~1,400 lines
of simulation (`gamemakerAgency`, `wildcards`, `watch`, `mentors`,
`legendaryItems`, `audience`) is imported by no UI file at all**, and
`excitementRating` — the currency three of them trade in — appears nowhere on
screen.

---

## §1. Bugs

Ordered by severity. All are confirmed by reading the current tree.

### Severe — changes run outcomes or loses data

1. **Every feast day costs every tribute a day of `daysSurvived`.**
   `phases/dayNight.ts:101` and `phases/bloodbath.ts:137` are the only writers, and a
   feast *replaces* that day's day-phase (`simulator.ts:101-107`) — so nobody alive
   through a feast day is credited with it. That count is what the epilogue
   (`epilogue.ts:103`), the Hall of Fame entry, `epithets.ts:58` and every achievement
   predicate reading `daysSurvived` are told the tribute lasted. `feast.ts:220` already
   carries a fix for the identical omission one field over (the cycle counter), which is
   how this one is recognisable. The Feast Quell compounds it: measured over four forced
   runs, feasts replaced 6 of 14 days, and victors finished 1–2 days short of the day
   the run actually ended on.

2. **`enterVerticalZone` runs on 1 of 5 movement paths.** `phases/dayNight.ts:1376`
   is the *wander* branch only; the objective step (`:1341`), the hunter's second hop
   (`:1355`), the group move (`:1315`) and multi-cycle transit arrival (`:1243`) assign
   `m.zone` without it. `samePlace()` gates sighting (`:154`) and encounters (`:1436`),
   so a tribute who moves *with an intention* — i.e. most movement — can be
   structurally unmeetable in a zone they walked into on purpose.
3. **Splinter alliances have no record for part of a cycle, and can never have a
   charter or a pact.** `alliance.ts:379`, `alliance.ts:445`, `alliancePolitics.ts:128`
   assign a fresh `allianceId` without `registerAlliance`; the back-fill is at
   `alliancePolitics.ts:277-295`, but `fractureBlocs` runs in day/night upkeep
   (`dayNight.ts:335`), so the splinter passes through `proposeBlocTreaties`,
   `tickBlocTreaties`, `enforceCharters`, `tickZoneControl` and `reconcileAlliances`
   with `allianceOf() === undefined`. `leaderFor` returns undefined so
   `dayNight.ts:1281` falls back to `allianceMembers[0]` — the array-order leader a
   comment says was fixed. The back-fill sets `pact: {kind:'no-pact'}` and no charter;
   `rollCharter`/`rollPact` only run inside `registerAlliance`, so **no group formed
   by fracture, schism or walk-out can ever have a charter or a pact.**
4. **Vengeance-pact settlement substring-matches a name into prose.**
   `vengeancePact.ts:142`: `members.some(m => target.causeOfDeath?.includes(m.name))`.
   `causeOfDeath` is authored prose, so `Ash` matches "Ashen Flats" and `Rue` matches
   "Bruel". The authoritative field `target.lastDamage?.sourceId` is right there and
   already used by `objectives.ts:885`. The pact's entire `paidThemselves` vs
   `takenByAnother` ledger is measured off this.
5. **`runToEnd`'s turn ceiling fails silently.** `store/gameStore.ts:1200-1232`.
   If `guard` trips, bets are never resolved, no victory is committed, nothing is
   logged, and the UI shows a half-finished run. Same block mutates
   `state.phase = 'ended'` from outside the `Simulator` API.
6. **Chokepoint collapse damage is applied twice.** `phases/dayNight.ts:1050-1063`.
   A crush survivor then takes the full base collapse damage again under the same
   `cause`, so the total is `damage * (1 + chokepointCrushMultiplier)` — invisible in
   the feed because both writes share one cause string.
7. **Scavenging and inheritance destroy items.** `stanceBeats.ts:129-137` empties
   `body.inventory` *before* the overflow is known and discards `dropped`; a Scavenging
   tribute at capacity annihilates a corpse's whole pack (compare `dayNight.ts:412-419`
   and `betrayal.ts:123-129`, which conserve the spill). `relationships.ts:236-243`
   filters the estate by item **name** — names are not unique — so once the heir fills
   up, every remaining same-named item is deleted from the body rather than left to be
   scavenged.

### Moderate — a mechanic silently does not fire, or fires wrong

8. **Forced finale picks "a rival" before checking where they are.**
   `objectives.ts:230-235`: `find` takes the first living non-lover in roster order and
   *then* tests co-location, so with three finalists a tribute standing next to rival B
   never forms the hunt objective because rival A — elsewhere — was found first.
9. **`forceStance` can fail while the narration asserts it happened.**
   `stance.ts:518-524` returns early on `stanceChurn >= churnMax`, with no return value.
   `resolve.ts:195-201` logs a surrender, `resolve.ts:223` logs walking into the open,
   `relationships.ts:320` logs a vengeance oath — all with the stance unchanged.
10. **`fortifiedCycles` is incremented on 1 of 4 return paths.** `stance.ts:663-667`
    increments; the hysteresis holds at `:690-694` and `:708-712` do not; `:722` resets.
    `stanceBeats.ts:66` then gates on exact equality (`held !== holdCycles`), so the
    Fortified set piece can be stepped over entirely.
11. **The night watch's "first time" line fires every night.** `watch.ts:67-83`:
    the sweep clears every stale `record.watch`, and `postWatches` runs once per night,
    so `already` is always false.
12. **Watch rotation only rotates among the top `minMembers`.** `watch.ts:50-52` mods
    by the *minimum group size*, not the camp size: in a five-person camp only the two
    best-sighted members ever take a watch, and on odd cycles it goes to the worse pair
    of eyes — halving the Light Sleeper's value for no stated reason.
13. **A present-but-failing ally blocks the execution branch entirely.**
    `downed.ts`: `if (allies.length > 0) {...} else { hostiles }`. Four Careers standing
    over a body get no decision because one twelve-year-old is kneeling there. The `else`
    should be "no rescue happened this cycle".
14. **Landed hits keep applying to downed tributes.** `combat.ts:213` makes
    `applyDamage` a no-op for the downed, but `landHit` continues to `openWound` (`:645`),
    `injure` (`:647-656`), burn (`:661`), poison (`:669`), fear (`:671-678`). Reachable
    via `resolveGroupCombat`/`resolveFreeForAll` when a tribute goes down mid-round.
15. **Four of six improvised weapons bypass the quality roll and can never be named.**
    `dayNight.ts:1119` and `:1149` use `giveItem(t, {...recipe})` (a shared object
    spread) where `:1087/:1103/:1135` use `mintItem(ctx.rng, …, QUALITY_BIAS.improvised)`.
    The terrain-driven four — the common case — never accumulate `durability`,
    `bloodDrawn` or a `legendName`. A club that kills twice cannot be named; a sling can.
16. **Half of a knob binds.** `encounters.ts:683-685`: `ENCOUNTER_BRANCH.friendlySanity`
    on one side, a hardcoded `10` on the other. Latent only because both are 10 today.
17. **Save normalisation waves ~55 fields through.** `utils/saveMigrations.ts:268-271`
    spreads `...(r as Partial<Tribute>)` and never re-states `downed`, `lastDamage`,
    `shadowing`, `objectiveTension`, `trusts`, `zoneLevel`, `epithet`, `token` and ~45
    more, while `standingGoal` and `shock` are validated right below. `downed` and
    `lastDamage` are objects with required sub-fields driving the rescue window and
    every obituary.
18. **`fear.ts:27-30`'s comment is inverted** relative to the code and to
    `data/archetypes.ts:58-66`. The code is right; fix the comment before someone
    "fixes" the code.

### UI bugs

19. **Dialog focus is stolen on every re-render.** `ui/useDialogFocus.ts:481` has
    `[onClose]`, and every call site passes a fresh arrow (`App.tsx:299`,
    `GameScreen.tsx:1016`, `:1026`, `TributeCompare.tsx:121`). During auto-play the arena
    re-renders per log line, so an open dialog yanks focus back to its first button
    continuously.
20. **Achievement toasts can become permanent, and drop the wrong ones.**
    `GameScreen.tsx:630-647`. The cleanup clears the pending `drop` timer; the early
    returns at `:637`/`:643` register no replacement, so the stack never clears.
    `setToasts(prev => prev.slice(fresh.length))` also removes from the *front* by a
    stale-closure count while `:644` truncates from the back.
21. **Achievement effect runs 185 predicates over full state on every advance.**
    Same effect, deps `[gameState.phase, gameState.day, isOver, gameState]` (`:647`).
22. **Two `TributeModal`s can mount at once** — `App.tsx:190` (palette) and
    `GameScreen.tsx:1031` (stage), each `aria-modal` with its own focus trap.
23. **Gamemaker buttons can be enabled and then silently no-op.**
    `DossierPanel.tsx:410-466` disables on the *base* cost; `GameScreen.tsx:128-136`
    charges `gamemakerEventCost(...)` — the escalated price — and returns early at `:130`.
    Cooldown is not reflected in `disabled` either. `DossierPanel.spendGamemaker` also
    ignores its `cost` argument (`:133-135`).
24. **`VISIBLE_CAP` is applied before density filtering.** `EventFeed.tsx:600` slices to
    200 raw lines; the tier filter runs at `:493`. At `headlines` density the newest 200
    lines may hold ~16 headlines, so the feed looks empty.
25. **The filtered count and the empty state are density-blind, on *both* screens.**
    `GameScreen.tsx:827`/`:926` and `ChronicleScreen.tsx:327` both pass
    `filteredLogs.length`, which counts what survived the category filters — while the
    feed then applies the reading density on top. So "Showing N of M" quotes a number
    the page never displays, and at `headlines` density a quiet phase renders a silently
    blank feed with the empty state's own check satisfied. (The audit first recorded this
    as the two screens disagreeing with each other; they agree, and are both wrong the
    same way.)
26. ~~The filter "active" dot is lit on a fresh install.~~ **Checked and withdrawn.**
    `filtersActive` returns true when `density !== 'everything'` and the shipped default
    is `'scenes'`, so the dot is indeed lit before the reader touches anything — but the
    dot means *some of the chronicle is hidden from you*, and at `'scenes'` the ambient
    tier genuinely is. Measuring it against the default instead lights the dot for
    `'everything'`, the one density that hides nothing, which is strictly worse. The
    attempted fix was reverted; `test:ui` caught it.
27. **`paginate()` runs on the full log, unmemoized, every render** —
    `ChronicleScreen.tsx:764`, purely to decide whether to draw a `•`.
28. **Dead deep-link initialiser.** `ChronicleScreen.tsx:666-670` calls `readDeepLink()`
    and discards it, returning `0` on both branches.
29. **CapsLock breaks two shortcuts.** `GameScreen.tsx:482` (`key === 'i'`) and `:487`
    (`key === 'p'`) compare the raw key while every other branch uses `lower` (`:419`).
    Both are advertised in the help overlay.
30. **Hall of Fame flashes its empty state** — `HallOfFameScreen.tsx:16` initialises to
    `[]` and loads in an effect at `:38`, so a player with 50 records first sees
    "Finish a simulation to crown your first victor" (`:206`).
31. **Ten uncleaned `setTimeout`s in event handlers**: `ShareButton.tsx:18,74`,
    `ChronicleExport.tsx:56`, `TributeModal.tsx:1261`, `HofTransfer.tsx:50`,
    `HallOfFameScreen.tsx:51`, `ChronicleScreen.tsx:103`, `EventFeed.tsx:356`, and
    `BroadcastBar.tsx:237`, which mutates `el.textContent` outside React's tree.
32. **Window key listener re-registers on every phase** — `GameScreen.tsx:509-512` with
    `gameState` and `filters` in the deps. Correct, but wasteful rather than wrong: one
    `removeEventListener`/`addEventListener` pair per advance. Listed as cleanup, not a
    defect.
33. ~~`EventFeed` reads a ref during render.~~ **Checked and withdrawn.** The memo reads
    `seenIds.current` but never writes it, and it is keyed on `logs` — so a StrictMode
    double-invoke sees the same set both times and a re-render with unchanged `logs`
    does not recompute. The pattern is unusual but correct as written.
34. ~~Odds-movement effect is one tick stale.~~ **Checked and withdrawn.** `oddsLadder`
    derives from `gameState.tributes`, and a phase change produces the new tributes array
    in the same commit the effect runs after — so the ladder it reads is current. The
    narrow dep list is the intended semantic ("movement since the last phase"), not an
    oversight.

### Knob-discipline drift (the `test:undeclared-knobs` blind spot)

`mentors.ts:41-77` holds an entire subsystem's balance table — `MENTOR_GENEROSITY`,
`MENTOR_PULL`, `MENTOR_TRUST_FLOOR = 34`, `MENTOR_TRUST_COST = 13`,
`MENTOR_EXCITEMENT_COST = 18`, `MENTOR_REPEAT_DECAY = 0.5`, plus `urgentNeed`'s
`35/72/82/60` (`:115-118`) — outside `data/balance.ts`. The check looks for literals
passed to `chance()`, on the right of `+=`, or beside a comparison; **an exported
`const` record matches none of those shapes.** Same class: `wounds.ts:89-99`
(`RECOVERY_CYCLES`, eight tunables). Plus inline literals at `dayNight.ts:1159`,
`memory.ts:193` and `:477`, `resolve.ts:220`, `combat.ts:435-446` and `:566-570`,
`objectives.ts:170-180`, `encounters.ts:622`. **Recommended fix: extend
`check-undeclared-knobs.ts` to a fourth shape — a numeric-valued exported `const`
record in `src/engine/` — then migrate these.**

---

## §2. QOL / UI / UX

### Accessibility

- Focus thrash in every dialog (§1.19) is the single worst a11y defect.
- `aria-live="assertive"` fires on every phase — `GameScreen.tsx:999`, recomputed at
  `:649` from `phaseLabel` + last death. Assertive should be reserved for deaths.
  Three live regions plus a hint region are mounted at once (`:995-1000`) with nothing
  serialising them.
- Toasts are not dismissible and not focusable (`:1004-1014`).
- Touch targets: chronicle scrubber ticks are `w-2.5 h-5` = 10×20px
  (`ChronicleScreen.tsx:838`), against the 44px floor `ArenaMap.tsx:62` and
  `GameScreen.tsx:980` already hold.
- The `?` help overlay exists only on the arena screen (`GameScreen.tsx:440`).
- **Reduced motion, phase pacing and arena briefing live only in the Playback popover**
  (`PlaybackPopover.tsx:154,166,180`), which only exists inside a running Games — while
  `SettingsPanel.tsx:9` advertises itself as every persisted preference. A player on the
  setup screen cannot turn motion down.

### Mobile / 390px

Responsive-utility counts: EndScreen 16, GameScreen 9, Roster 5, TributeModal 5,
Setup 4, Reaping 3, HoF 3, Chronicle 2, VictorInterview 2, and **zero** in
`StandingsTable`, `ZoneDossier`, `TributeTile`, `RunProfileCard`, `RelationshipGraph`,
`PlaybackPopover`, `OddsSparkline`, `HofTransfer`, `ShareButton`, `ReplayFallenStrip`.

`scripts/ui-test.mjs:511` checks overflow only on whichever screen the suite is on,
plus a dedicated arena pass at `:520` — **Setup, Reaping, Chronicle, EndScreen and Hall
of Fame are never checked at 390px.** Specific breakages: the chronicle pager
(`ChronicleScreen.tsx:814`) is a sticky bottom row holding prev/next, a ~30-tick
scrubber, a day `<select>` and a counter with no `md:` treatment; `StandingsTable:122`
and `ArenaMap:67` are horizontally-scrolling panes inside a scrolling pane;
`PlaybackPopover:101` has no sheet fallback; `TributeModal:376` nests two scroll
regions; and the mobile bottom bar exists only on the arena route.

### Performance

No virtualization anywhere in `src/`. Mitigation is slicing, and it has four problems:
the cap precedes density (§1.24); `EndScreen.tsx:178` renders the whole chronicle
expanded; `EventFeed.tsx:601` runs `groupLogs` unmemoized and `:606`'s memo never hits
because `visibleLogs` is a fresh identity every render; `GameScreen.tsx:518` memoizes on
the whole `filters` object so a search keystroke re-filters 650+ lines.

### Settings that don't persist or don't apply

- "Reset chronicle filters" is storage-only — `SettingsPanel.tsx:177` writes storage and
  never touches the live store, hence the apologetic "(takes effect next run)".
  `resetChronicleFilters()` already exists at `chronicleStore.ts:455`.
- Playback speed is not persisted — `GameScreen.tsx:116` `useState('manual')`.
- Stage tab, mobile pane, filters-open and help-open are component state
  (`GameScreen.tsx:141-146`), so resuming a save drops the reader on the chronicle tab.
- `gamemakerMode` (`SetupScreen.tsx:210`) and `forceQuell` (`:211`) are not in
  `GameConfig` and so not in `CONFIG_SPEC` — unlike every slider, they reset on reload.

### Information the engine computes and never shows

Verified by grepping field names against `src/components` and `src/screens`:
`excitementRating` (**zero UI references** — the metric `audience.ts:14` centralises,
that sponsors price off, and that the Gamemakers escalate on), `unseenStreak`,
`sleepDebt`, `dread`. And six modules no component imports at all:
`engine/watch.ts` (who stood guard), `engine/mentors.ts` (314 lines of tiered
generosity, pull, trust floor, repeat decay), `engine/gamemakerAgency.ts` (429 lines,
nine signatures, grudge intervention, bloodless hunt — with a *named* head Gamemaker on
the reaping screen the player can never connect them to), `engine/wildcards.ts` (424
lines), `engine/legendaryItems.ts` (`namedWeapons()` at `:90` exists for a panel that
was never built), `engine/audience.ts`.

### Tedium and flow

Setup renders 41 full-height arena rows as buttons (`SetupScreen.tsx:669`) with no
search and no "recently played"; patronage is a two-step confirm three tabs from the
start button (`:847,861`), buying a map another (`:896`); betting uses two different
staking models on one screen (`RosterScreen.tsx:1509`); save notes are
`defaultValue` + `onBlur` with no saved indicator (`SetupScreen.tsx:348`);
`window.confirm` is the destructive guard at `:270` while every other confirm in the app
is an inline two-button pattern. Share URLs carry seed/arena/config/quell but **not**
`grudgeMatchIds` or the off-season skin, so a shared link can desync from the run it was
copied from.

### Playback

Already deep: four speeds, drama-scaled pacing, per-phase multipliers, five brakes,
"run until", 16-deep rewind. Gaps: no step-back-one-line; no scrubber on a *live* run
(`ReplayScrubber` is debrief-only); no custom speed; the pause notice doesn't say which
brake fired.

---

## §3. Tribute logic — robustness and complexity

**What is already genuinely deep** (do not rebuild): the stance table
(`stance.ts:333-487`) with preconditions, entry latency, exit cooldown, minimum holds,
churn-widened margin and conditional-incumbent bonus; `assessZone` (`:84-150`) as a
real *estimate* with staleness regression toward "average tribute" and a `read`-weighted
blend toward truth; `riskTolerance` (`risk.ts:25-42`).

**Where it still collapses to one roll:**

- **The pair encounter.** `encounters.ts:602-608` — sworn vengeance short-circuits
  straight to `resolveCombat` before truce, stance, fear, dread, health, weapon or
  parley is consulted. A tribute at 6 health, unarmed, Evasive, terrified, attacks.
  Everything the decision layer computed that cycle is discarded by one `includes()`.
- **The shadow ambush.** `stanceBeats.ts:73-85` — `spotted` is only evaluated when
  `t.zone === quarry.zone`, but the whole point of the stance is being one zone behind,
  so in the normal case the detection roll never runs and `trail.cycles` accrues
  unconditionally. Then `t.zone = quarry.zone` is a free teleport past travel cost,
  transit, severed edges, collapsed zones, force fields and verticality, followed by an
  unconditional ambush. Three cycles of guaranteed accrual ending in a guaranteed hit.
- **Downed resolution** (`downed.ts`) is one `rescueChance` and one `executeBase` roll
  per cycle with no per-attempt state; `failedRescuer` is set and never read.

**State written and never read:** `trucesBrokeredHeld` (`parley.ts:704`, the Diplomat's
signature currency, read nowhere in `src/`); the whole `trainingPacts` conviction/terms
model (`training.ts:451,471-490` — the bloodbath reads the flat `trainingPact` id list
instead at `bloodbath.ts:226`, and `expiresCycle` stores a duration in a field named for
an absolute cycle); `privateSession` (`training.ts:871`, used only to render its own log
line); `forageSuccesses` (`intent.ts:134`, read only by achievements while the
exhaustion loop reads `forageFailures`).

**Missing feedback loops — the highest-value additions:**

1. **Dissociation cannot be corrected.** `memoryUnreliable` + `distortion`
   (`memory.ts:130-166`) is deterministic per tribute-per-zone, so a scarred tribute
   blanks or invents the *same* zones all run and standing in the invented deathtrap
   teaches them nothing. `checkIntelLies` (`memory.ts:690`) already does exactly this
   correction for a lie someone told them — the machinery is one function away.
2. **`hold`/`wait` objectives are graded as automatic wins.** `objectives.ts:889`:
   `won = t.zone === previous.zone`, and a holding tribute by definition did not move.
   The outcome ledger driving `sameTargetPenaltyFor` is fed a stream of free successes.
3. **Shock, dread and resolve never reach the same decision.** `inShock` outranks the
   whole scorer (`stance.ts:585`); `dreadOf` touches only Evasive/Aggressive;
   `hasBroken` reaches only Desperate's precondition. None inform `objectiveStep` or
   destination scoring, so a cowed, broken, shocked tribute still walks the shortest
   path to a hunt objective set three cycles ago.
4. **Give `objectiveZone` a *believed* position that can be wrong** rather than gating
   the true position behind `rememberedRivals > 0` (`objectives.ts:827`). A hunter who
   goes to the wrong clearing is a story; a hunter who never forms the intention is a null.
5. **Feed `objectiveOutcomes` back into stance**, not just target choice: four failed
   hunts should lower Aggressive's score.
6. **Make `read` two-directional in combat**, not only in threat assessment —
   `rematchEdge` exists but keys on fights rather than on `read`.

---

## §4. Relationships and alliances

**Modelled well, with a written contract at `relationships.ts:480-499`:** four axes
(regard / respect / trust / suspicion) and a rule for which decision reads which;
`trustOf` (`:58-76`) genuinely derived; `decayTrust` (`:98-111`) asymmetric; backstory
seeding (`:143-199`) across district partners, academy classmates, tesserae hardship,
archetype kinship, age gaps, fan-favourite envy; death fallout (`:257-409`) with four
distinct beats. `alliancePolitics.ts:47-140` is the strongest module in the group —
factions *detected* from per-pair suspicion, resolving as coup, expulsion or walk-out.

**Vestigial or broken:**

- Splinter groups can never hold a charter or a pact (§1.3). This is the biggest single
  hole in the alliance layer: every group the politics layer creates is a second-class
  group forever.
- `trucesBrokeredHeld` is write-only (§3).
- **Triangles are discarded on death.** `triangles.ts:160-166` filters the record out of
  `state.loveTriangles` entirely when any of the three dies, with no line and no trace —
  so the epilogue cannot mention a triangle the arena resolved by killing the apex.
  Contrast `vengeancePact.ts:382-395`, explicitly fixed for this exact failure.
- **`forceTriangleChoice` is gated on the counter it was meant to bypass.**
  `dayNight.ts:253` calls it every endgame cycle, but `resolveChoice:215` returns unless
  `tri.heat >= TRIANGLES.choiceMinHeat`. A triangle between two people never co-located
  reaches the endgame at heat 0 and is never forced.

**Missing:**

1. **No reconciliation path for trust.** `reconcileRivals` (`rapport.ts:568`) walks
   `fights` down and adjusts regard and respect, and never touches `trusts` or
   `suspicion`; `decaySuspicion` is the only way down. Two tributes can fully reconcile
   on regard while suspicion sits where the last betrayal left it.
2. **`inheritFrom` only runs for a co-located heir** (`relationships.ts:224`), so the
   commonest death — alone, elsewhere — leaves the estate *and the oaths* on the corpse.
   The oath-inheritance beat, the interesting half, is rare by construction.
3. **Betrayal has no anticipated cost.** `preemptiveBetrayer` (`betrayal.ts:232-244`)
   models the striker's mind; nothing models the victim's counter. A tribute with high
   suspicion has no way to *leave* except a faction walk-out needing two other members.
   Add a solo "slip away in the night" exit.
4. The witness-vs-victim distrust split is two magic divisors
   (`relationships.ts:467` `/3`, `:476` `/2`).

---

## §5. Arenas — robustness and complexity

40 arenas, 415 zones, all backed by a hand-authored signature function (LOC 15–97,
median 28). Composite richness spread is only **49.6 to 83** — and the bottom half is
not thin so much as *uniform*, which is the worse problem.

Richest: storywood 83, redcathedral 82.9, kelvin 82.3, culdesac 77.7, labyrinth 77.1.
Thinnest: seapeaks 49.6, canopyweb 52, canopy 52.1, warren 53.6, acousticforest 53.9.

**What actually varies:** zones 6–13 (mean 10.4); all 14 laws used, but 30 arenas carry
exactly one and only `nooneplace` carries three; 40 bespoke signature functions.

**Structural axes the `Arena` type supports and content barely uses:**

| Field | Used by | Note |
|---|---|---|
| `signatureRule` | **0/40** | The declarative DSL (6 triggers × 6 selectors × 6 payloads × 3 telegraphs = 648 shapes) is fully implemented at `arenaSignature.ts:1908` and **dead for every arena anyone plays** |
| `restockBias` | 17/40 | 23 Cornucopias restock identically — the exact failure the field's own doc comment exists to fix |
| `cornucopiaLayout` | 7/40 | 33 default to `plate` |
| `sponsorMultiplier` | 7/40 | 33 arenas share one sponsor economy |
| `terrainVariant`, `muttRoster`, `offSeason` | 0/40 | procedural-only; no hand-authored arena can retune terrain danger |
| `edgeRules` | 33/40, mean 1.2 | `contested` 1 use, `oneWayAfter` 1, `hidden` 2 — effectively dead kinds |
| climate profile | **28/40** | 12 arenas have no climate at all: clockwork, concrete, canopy, vault, warren, terraces, canopyweb, culdesac, labyrinth, ashgrove, menagerie, storywood |
| `ZoneFeatures.waterSource` | **26/415 zones (6.3%)** | vs chokepoint 193, vertical 165, elevation 103 — water scarcity is a headline mechanic with almost no map presence |
| terrains | **6 of 10** | `cave`, `ice`, `desert`, `urban` appear in **no** hand-authored zone, yet 15 mutts declare `terrainPreference` for them — those mutts can only ever appear in procedural arenas |

**Recommendations, in order:** (a) author `signatureRule` for 10–15 arenas as a second
signature alongside the bespoke function, which turns 648 combinations live for ~0 code;
(b) give the 12 climate-less arenas a profile; (c) raise `waterSource` coverage to
~15% of zones; (d) use `cave`/`ice`/`desert`/`urban` in at least four arenas so their
15 mutts become reachable; (e) set `restockBias` on the other 23.

---

## §6. Small / side features

| Module | Lines | Verdict |
|---|---|---|
| `sideMarkets.ts` | 383 | Real. 11 markets, field-share pricing, moving lines, push handling, settlement |
| `gamemakerAgency.ts` | 429 | Real, **invisible** — nine signatures, grudge intervention, bloodless hunt, no UI import |
| `wildcards.ts` | 424 | Real, **invisible** — 27 kinds, only the announcement reaches the player |
| `gamemaker.ts` | 346 | Real, but its UI contract is broken (§1.23) |
| `offSeason.ts` | 335 | Medium, cosmetic only — 80 skins at an 18% draw, no mechanical consequence |
| `mentors.ts` | 314 | Real, **invisible**, and its whole balance table is outside `balance.ts` |
| `sponsors.ts` | 188 | Real. Compounding repeat decay, rarity gate, need-weighted choice |
| `notoriety.ts` | 157 | Real, small. Reputation *trading* between tributes is a nice mechanic seen only in the modal |
| `playerSponsor.ts` | 133 | Real, small |
| `odds.ts` | 112 | Real. `oddsFactors()` (`:58`) returns labelled contributions — check they are actually rendered, not just `pct` |
| `sponsorBlocs.ts` | 103 | Medium — static table, no arc across a run |
| `legendaryItems.ts` | 93 | Thin; `namedWeapons()` exists for a panel never built; four of six improvised weapons can never earn a name (§1.15) |
| `watch.ts` | 90 | Thin, partly broken (§1.11, §1.12), invisible. **Nothing reads `record.watch` — a night ambush does not check the sentry.** |
| `epithets.ts` | 77 | Shallow but complete and the best-surfaced small feature in the app |
| `veterans.ts` | 72 | Reaping-only graft: `veteranOf` is read by nothing in the engine. **A veteran plays identically to a first-timer after the gong.** |
| `audience.ts` | **20** | One line deep, widest blast radius, value never displayed |
| `zoneControl.ts` | 128 | Named for a general mechanic, implements **one location** (the Cornucopia, `:144`) |
| `abandonedCamps.ts` | — | Trigger requires `objective.kind === 'flee'` (`:43`), so border collapse, betrayal, feast and simply walking away destroy the camp silently. Keys last-cycle position in a module-level `WeakMap` (`:31`) rather than on `GameState`, so **the trace is lost across save/resume** — state outside the seeded state |
| `persona.ts` | — | Two of thirteen tests are not behavioural: `'The Humble Underdog': t => !t.isCareer` and `'The Grieving Sibling': t => t.kills === 0` (`:56-61`). `isCareer` is fixed at the reaping, so an Underdog-persona non-Career collects excitement every cycle forever |

**The sharper problem is exposure, not depth.** Those six invisible modules are ~1,400
lines of simulation with no component importing them.

**`wildcards.ts:49` and `:92` replace `ctx.rng` and never restore it** — safe today only
because every phase entry point reseeds, an invariant stated in `simulator.ts:29-33` and
nowhere near these lines.

---

## §7. More ways to die, more events

### Current inventory

1,323 arena event definitions (1,065 unique causes), 48 universal events (19 non-lethal),
30 generic fallback, 96 procedural biome + 32 shared procedural, 80 `DEATH_TEXTS`,
152 weapon-kill templates, 196 mutts.

**But: every single arena pack is 33 or 34 events** — 24-or-25 authored base plus
*exactly 9* extras, in all 40 arenas. The floor/target split in
`check-flavor-pools.ts:76-90` was introduced precisely to stop content converging on a
threshold, and it has re-converged one tier up.

### Gating: the schema is far richer than the content

Only **~170 of 1,323** events carry a `requires` block at all:
time 70, law 25, storm 22, effect 15, elevationOrChoke 14, trait 12, maxSurvivors 11,
stance 8, minSurvivors 7, sanityBand 5, loadBearing 3.

- **`requires.trait`: 12 uses, each a different trait** — no trait in the game has more
  than one bespoke event.
- **`requires.stance`: 8 uses**, one or two per stance.
- **`requires.loadBearing`: 3 uses, against 107 `ruins` zones.**
- **`requires.effect` never references `stripped`, `blooming`, `irradiated` or
  `swarming`** — 4 of 10 effect kinds cannot gate an event.
- `startsZoneEffect`: `stripped` 1, **`quaking` 0** (reachable only via
  `special: 'startsQuaking'`).
- `dodgeStat` distribution: intelligence 390, agility 363, stealth 128, willpower 113,
  endurance 65, strength 41, **charisma 4** — charisma is a dead dodge stat, and
  `rollEscape` falls back to strength anyway.
- 374 of 1,323 events still rely on keyword-inferred terrain (`encounters.ts:367`).

Note that in `pickTerrainEvent` each filter stage falls back to the prior set when it
empties, so **gates are soft** — a `requires` block is a preference, not a guarantee.

### Recommended additions

**Universal deaths, built on systems already simulated but never lethal:**
infection going septic (`septicCycles` exists and nothing kills with it); sleep-debt
collapse (`sleepDebt` is tracked and repaid and never harms); starvation-condition
cascade (`Padded → Lean → Wasted` is modelled; nothing dies at the end of it); a fall
from `upper` during a forced descent (verticality carries a fall risk that never
finishes anyone); structural collapse under a tribute who fortified a `ruins` zone
(`loadBearing` exists, 3 events gate on it); a mutt kill during a watch nobody stood
(`record.watch` is written and read by nothing); dying of a wound to the `favouring`
limb while carrying a weapon that needs it.

**Arena-specific:** the twelve climate-less arenas have no weather death of their own at
all. The four unused terrains (`cave`, `ice`, `desert`, `urban`) have 15 mutts waiting.

**Events:** give each of the 62 traits at least one `requires.trait` event (12 → 62);
give each of the 8 stances two (8 → 16); raise `requires.loadBearing` to one per
ruins-heavy arena; add `requires.effect` entries for the 4 unreachable effect kinds;
add `quaking` as a `startsZoneEffect`. Weight new work toward the **duplicate causes**
that already repeat: "Lost in the maze" ×12, "Died of fright" ×9, "Froze when the
generator failed" ×9, "Took a bargain" ×8.

---

## §8. Trait and archetype balance audit

### Traits — 62 (45 rollable, 17 earned)

**Numeric outliers:**

- **`Unremarkable` `targetDraw: -28`** is the largest number in the file by ~3.5×. The
  next largest on that hook is `Eagle-Eyed: -4`, and the archetype scale tops out at
  `career: 5`. On a scale where 5 means "the whole arena wants you dead", −28 is not a
  modifier, it is **invisibility from targeting**. This is the single most important
  balance item in the game.
- **`Charismatic`** is the pre-Games trait entire: `sponsorAppeal: 8` (its only user),
  plus `sponsorTrust 1.5`, `defended 0.35`, `excitement 0.2`, `allianceAffinity 0.2`,
  with no counterweight.
- **`Insomniac` `fatigueNight: 10`** is the largest flat vitals penalty, traded against
  `awarenessNight: 2` — the only use of that hook, so the trade is un-benchmarkable.
- **`Nimble`** (|mag| 0.13) is the weakest trait in the file, a rounding error beside
  `Silent Step` and `Chameleon`.
- **`Light Sleeper`** is a one-hook trait (`awareness 1.2`) and a strict subset of
  `Tracker`. Dead identity — give it a night/watch-specific hook (it is the trait the
  watch rotation is supposed to reward, and §1.12 halves that reward).

**Overlapping identity clusters** (merge or differentiate): three trap traits
(`Trapper`/`Trapwise`/`Strategist`); three poison traits where **`Herbalist` strictly
dominates `Venom-Wise`**; three water traits (`Hydrophilic`/`Swimmer`/`Waterborn`);
three fire/heat traits; three scavenge traits.

**Hook distribution is lopsided:** `retreat` is carried by 16 traits and
`allianceAffinity` by 14 — those two are doing the work of a whole system — while 12 of
51 live keys are used by exactly one trait (`thirstDrain`, `awarenessNight`,
`coldResist`, `executeDrive`, `highland`, `wrestle`, `burnOnHit`, `vengeanceEdge`,
`defended`, `sponsorAppeal`, `persuasion`, `muttDamage`). `combatPower` (3 traits)
overlaps `meleePower`/`rangedPower`/`unarmedPower` (2 each), so "combat trait" means
two different things.

### Archetypes — 15

- **`targetDraw` is set on exactly one archetype** (career: 5) — a 1-of-15 property, not
  an axis. `fearScale` on 4 of 15. `riskCurve`: flat 8, escalating 5, **front-loaded 2**.
  `targetPreference`: nearest 6, weakest 4, richest 3, **strongest 1, rival 1**.
- **`protector` / `medic` / `diplomat` are the same row within ±0.1 on every scalar**,
  all `nearest`, all Charismatic-preferring. Same for `strategist` / `scholar`, and
  `trickster` / `saboteur`.
- `hatesArchetypes` is empty on 6 of 15, and `career` is the target of 3 of the 9
  edges — the antipathy graph is a hub-and-spoke.
- `CAST_SHAPE_ARCHETYPE_WEIGHTS` covers 7 shapes; `CAST_SHAPES` lists 8 — **one cast
  shape has no archetype weighting**. `CAST_SHAPE_EXCLUDES` has exactly one entry.

**Recommended:** rescale `targetDraw` to one shared −5..+5 scale; spread `fearScale`,
`riskCurve` and `targetPreference` across all 15; differentiate the three caretaker
archetypes on treachery and target preference; fill the missing cast shape; and add a
`test:metrics` assertion that no trait's summed magnitude exceeds 3× its category mean
on a per-hook basis (the current 1.5sd check compares across incomparable scales, which
is how `targetDraw: -28` survived).

---

## §9. Replayability

**Today:** deterministic seeds and share URLs; 9 temperaments, 27 wildcards, 8 cast
shapes, 27 Quarter Quells; 50-entry Hall of Fame with compare/pin/re-run; 158
achievements with near-misses; 80 off-season skins at an 18% draw; district legacy;
coin economy with 11 prop markets; grudge tiers, veteran seating, daily seed.

**Where it goes flat:**

1. **The player has almost no agency inside a run.** After the gong: advance, rewind,
   one sponsor parachute per tribute, and the Gamemaker levers — which are **gated
   behind a mode chosen at setup** (`SetupScreen.tsx:750`). A non-Gamemaker run is a
   pure spectator tape.
2. **Quells are the best variety content in the game and most players will never see
   one.** `NO_QUELL_WEIGHT = 600` (`engine/gamesProfile.ts:70`) means most runs have
   none; the only reliable route to the 27 authored rule sets is a Force checkbox buried
   in the `meta` tab and disabled under Plain Rules.
3. **Difficulty is three multipliers and two booleans.** Mutators and presets are
   recombinations of exactly those (`replayHooks.ts:98`). There is no axis the player
   can be good or bad at, because there is nothing to be good at.
4. **The daily is a seed, not a challenge** — `dailyConfig()` returns
   `DEFAULT_GAME_CONFIG` (`replayHooks.ts:132`); no score, no objective, no leaderboard.
5. **Meta-progression is a wallet and a checklist.** Nothing about the world changes
   across runs except grudge tier and district standings.

**Highest-leverage levers, cheapest first:**

- **Pick-your-Quell mode.** 27 authored rule sets already exist and are invisible. One
  selector. Biggest content-per-line win in the report.
- **Mentor mode as the default agency layer.** `parley.ts` (894 lines), `intent.ts`'s
  objective queue and `mentors.ts` (314 lines) are already written; spend
  excitement/trust to nudge one tribute's objective. This makes `excitementRating` — the
  currency nothing displays — into the resource the player manages.
- **Ungate the Gamemaker booth** from the setup-time mode, or make it the default.
- **A daily challenge with a score and a result string**, over the daily seed that exists.
- **Season/tournament mode** over the 40 arenas with carried-forward district standings.
- **Persistent world state**: victors who mentor mechanically in the next reaping
  (`mentorLegacy` and `victorIds` are already stored), district economies that shift.

---

## §10. Shallow or incomplete mechanics, and flavour breadth

**The test for "wired":** a subsystem is wired when a tribute's decision changes because
of it, not when the phase loop calls it. The deep modules (`memory`, `parley`, `debts`,
`rapport`, `blocTreaty`) all have a read site inside `combat.ts`, `objectives.ts` or
`stance.ts`. The thin ones are each a single `tick*` call in the upkeep block
(`dayNight.ts:274-362`) writing state only they read.

Shallow, in priority order: `veterans` (a veteran plays identically to a first-timer),
`watch` (nothing reads who was awake), `zoneControl` (one location), `audience` (20
lines, invisible, central), `abandonedCamps` (one trigger, state outside `GameState`),
`persona` (two non-behavioural tests), `legendaryItems` (two thirds of improvised
weapons cannot be named), `traitArcs` (`traitAge` incremented for every trait, read for
two), `stanceBeats` (Fortified under-gated, Shadowing unconditional).

**Flavour, measured.** A run is **1,313 log lines** at default config — twice the ~650
figure `POOL_TARGET = 12` was derived from. **105 of 259 exercised pools (41%) repeat a
line inside a single run.** Worst offenders:

| Pool | Size | Draws/run | Worst repeat |
|---|---|---|---|
| `SANITY_TEXTS.hallucination` (`flavorText.ts:782`) | 10 | 18.0 | **8× in one run** |
| `actions.hide`, every arena | 8 (5 in seapeaks, 4 in cabin) | 10.6–14.8 | 4–7× |
| `SPONSOR_TEXTS` | 19 | 20.6 | 5× |
| `TRAINING_MINGLE` | 15 | 16.4 | 4× |
| `INTERVIEW_CLOSERS.strong` | 10 | 14.4 | 4× |
| `VENGEANCE_TEXTS` | 24 | 12.2 | 3× |

`VENGEANCE_TEXTS` is the pool the target was *designed around*, and it repeats.
**Recommended: re-derive `POOL_TARGET` from measured draws-per-run rather than a flat
number — a pool's floor should be ~2× its own measured draw rate**, which would put
`SANITY_TEXTS.hallucination` at 36 and `actions.hide` at 30 while leaving `actions.travel`
at 12. Then raise the conditional-stance pools from 4 (worse than the 12-entry fallback
they replace) and author them for the 22 arenas with none.

**Other flavour breadth gaps:** 8 of 12 procedural biomes have no flavour pack at all;
`TRAINING_STATIONS` is 5×8 = 40 and is in heavy rotation; five arenas run 25-line action
sets against 28 arenas' 42.

---

## §11. More achievements, more names

### Achievements — 158 today

| | common | uncommon | rare | legendary | total |
|---|---|---|---|---|---|
| social | 5 | 11 | 24 | 6 | **46** |
| survival | 4 | 4 | 10 | 4 | 22 |
| arena | 0 | 7 | 10 | 3 | 20 |
| combat | 2 | 7 | 7 | 4 | 20 |
| capitol | 5 | 6 | 6 | 2 | 19 |
| games | 0 | 5 | 6 | 1 | 12 |
| oddity | 0 | 4 | 3 | 3 | **10** |
| reaping | 5 | 3 | 1 | 0 | **9** |

`social` is 29% of the list — more than `arena` + `combat` combined. `reaping` and
`oddity` are the thin shelves; `rare` is 42% while `common` is 13%; `nearMiss` is
present on only 92 of 158; **`availableIn` is set on exactly 1 of 158**, so every other
entry silently advertises itself in arenas that cannot produce it.

**90 of `Tribute`'s 166 fields and 68 of `GameState`'s 97 are untouched by any
predicate.** The most obviously achievement-shaped: `firstBloodId`, `everDowned`,
`finishingBlows`, `muttsSurvived`, `trapsDisarmed`, `septicCycles`, `traps`, `camps`,
`loveTriangles`, `vengeancePacts`, `feastTheme`, `forceFieldSeen`, `truceLedger`,
`veteranOf`, `sleepDebt`, `woundInfection`, `zoneHeld`, `platePosition`,
`weaponFamiliarity`, `stylist`, `chariotAngle`. **Target: ~40 new entries weighted to
`reaping`, `oddity` and `games`, plus `availableIn` on every arena-conditional entry
and `nearMiss` on the 66 that lack it.**

### Names — 3,200 today

16 districts × 2 genders × exactly 100. 3,009 unique; 191 names sit in two districts,
concentrated in the ornamental (D1/D2) and technical (D3/D5) registers. Mean length
6.4 chars.

**The real gap is not count, it is structure: there are no surnames at all.** Zero
entries contain a space. Meanwhile the game models district partners, siblings (the
`Grieving Sibling` persona, `sharedHistory`, `districtBondNoted`), dynasties
(`dynastyStreak`, `victorIds`, `mentorLegacy`) and returning victors — **with no naming
vocabulary to express family.** A returning victor's district cannot read as the same
family.

**Recommended:** (a) add a per-district surname pool (~40 each, 640 total) and a
`surname` field, used for district partners, siblings and victor dynasties; (b) top the
ornamental/technical registers so the 191 cross-district collisions can be reduced;
(c) unhardcode the `Gender` binary from the name-table shape if non-binary tributes are
ever wanted — it is currently load-bearing at `types.ts:1`.

---

## Recommended order of work

**First, §1**, in this order:

1. Feast-Quell day-phase starvation (`simulator.ts:100-156`)
2. `enterVerticalZone` on all five movement paths (`dayNight.ts:1243,1315,1341,1355`)
3. `registerAlliance` for all three splinter sites, so charters and pacts roll
   (`alliance.ts:379,445`, `alliancePolitics.ts:128`)
4. Vengeance settlement off `lastDamage.sourceId` (`vengeancePact.ts:142`)
5. `runToEnd` guard logs and surfaces (`gameStore.ts:1200-1232`)
6. Chokepoint double-damage (`dayNight.ts:1050-1063`)
7. Item conservation in scavenge and inheritance (`stanceBeats.ts:129`,
   `relationships.ts:236`) — filter by identity, not name
8. Finale rival co-location predicate (`objectives.ts:230`)
9. `forceStance` returns a boolean; three callers branch on it (`stance.ts:518`,
   `resolve.ts:195,223`, `relationships.ts:320`)
10. `fortifiedCycles` on all hysteresis paths + `>=` in `stanceBeats.ts:66`
11. Watch: first-time de-dup and rotation modulus (`watch.ts:50,67`)
12. Downed `else` → "no rescue this cycle" (`downed.ts`)
13. `landHit` early-returns for the downed (`combat.ts:645`)
14. `mintItem` for all six improvised weapons (`dayNight.ts:1119,1149`)
15. `friendlySanity` on both sides (`encounters.ts:683`)
16. Save-migration: materialise `downed`, `lastDamage` and the other ~53
    (`saveMigrations.ts:268`)
17. `fear.ts:27` comment
18. UI: `useDialogFocus` deps (§1.19); toast lifecycle (§1.20); achievement effect deps
    (§1.21); single `TributeModal` (§1.22); Gamemaker button disabled state (§1.23);
    density-before-cap (§1.24); density-aware count and empty state (§1.25);
    `filtersActive` (§1.26); memoize `paginate` (§1.27); dead deep-link (§1.28);
    CapsLock (§1.29); HoF loading state (§1.30); ten timer cleanups (§1.31)
19. Extend `check-undeclared-knobs.ts` to catch exported numeric `const` records, then
    migrate `mentors.ts:41-77` and `wounds.ts:89-99` into `data/balance.ts`

**Verification.** `npm run lint`, `test:sim`, `test:arenas`, `test:decisions`,
`test:achievements`, `test:predicates`, `test:flavor`, `test:knobs`,
`test:undeclared-knobs`, `test:zone-features`, `test:names`, `test:storage`,
`test:metrics`. For the Feast-Quell fix specifically, add a soak assertion that every
run enters the `day` phase at least once per game-day and that `daysSurvived` equals the
victor's final day. For the vertical-movement fix, assert that no living tribute's
`zoneLevel` is `upper` in a zone whose features declare no vertical. `npm run test:ui`
needs `npm run dev` on port 3000.

**Then, by leverage.** The cheapest large wins, in order: pick-your-Quell mode (§9 — 27
authored rule sets already written and effectively invisible); surfacing the six
unimported engine modules and `excitementRating` (§2, §6 — ~1,400 lines of simulation
the player never sees); re-deriving `POOL_TARGET` from measured draw rates (§10);
authoring `signatureRule` for the hand-built arenas (§5 — 648 combinations, already
implemented, zero used); rescaling `targetDraw` (§8). §3, §4, §7 and §11 are content and
design work, sized in their own sections.
