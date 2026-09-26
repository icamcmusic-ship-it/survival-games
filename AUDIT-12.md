# Survival Games — AUDIT-12: current-code audit and expansion plan

Audited revision: [`c7aae11`](https://github.com/icamcmusic-ship-it/survival-games/tree/c7aae11) (merge of #100). Audit date: 26 September 2026.

This is an audit and backlog. No production source was changed. **Confirmed** = reproduced by execution (seeded harnesses, `check-*` scripts, Playwright/Chromium at 1280 px and 380 px, light and dark) or verified line-by-line in source. **Plausible** = clear code path, not observed in the sampled runs. Items recorded as fixed in `CHANGELOG.md` / AUDIT-1…11 are excluded. AUDIT-11 E1–E5 and U1–U22 were re-checked: all fixed except the partial U1/U18 noted in §3.3.

**Naming constraint (unchanged):** one given-name field only. No surnames, surname pools, toggles, generation or hidden metadata.

---

## 1. What matters most

1. **Fleeing the bloodbath is a death sentence (T1).** Runners die at the horn 58 % of the time vs 24 % for those who fight at the mouth. The run-down pass runs *before* the scrum, when `shortfall = 1`, so the 0.85 catch floor always applies. This single bug is why every cautious archetype (forager, confessor, underdog, archivist, healer-pacifist, hermit) sits at the bottom of the table.
2. **Arena acts strand zones (E1).** In 52 of 60 act-arena runs a zone was cut off completely; 3 had tributes trapped inside. The act cuts are then reopened early by the generic tick, and `restoreCuts` deletes cuts made by other systems (E2).
3. **Stale alliance roles (E4, E16).** A dead quartermaster/leader silently switches off shared meals, camp siting and duties for the rest of the Games.
4. **Food appears from nothing (T3).** Friendly meetings and camp meals relieve hunger without using an item; starvation is 0.1–0.2 % of deaths and the Trapper/famine storylines barely exist (trap: 1 death in 3,616).
5. **Dark-mode hero bands and coins chip are unreadable (U1)**, and every hero band is ~480 px tall because the ghost numeral sits in normal flow (U2).
6. **Staleness:** ~29 % of every run's lines are within-run repeats, and ~100 headline beats appear in at least half of all runs; per-district reaping lines are fixed text.

## 2. Evidence

| Check | Result |
|---|---|
| `npm run lint` | Pass. 0 errors, 16 warnings (hook deps, refs-during-render). |
| `test:sim` | Pass. No invariant violations; 129/129 typed beats. |
| replay, replayability (5/5), storage-migrations, whatif, review-fixes (7/7), fingerprint (`c4f97525`), arena-layout (175), zone-features, validate-arenas (55/55), scenarios (28/28), endgame, actions, references, hearings, mercy | All pass. |
| `METRICS_RUNS=1000 test:metrics` | All guards pass. Mean 11.45 days, Career victors 42.9 %, victor kills 2.80, zero-kill victors 2.5 %. |
| `check-coverage` (300 runs) | 144/144 beat types fire; rare: expulsion 0.7 %, treaty-outgrown 3.0 %, waterborne-illness 3.3 %, parachute-lost 3.7 %, rival-thaw 4.7 % of runs. |
| `check-cause-codes` (200 runs, 3,616 deaths) | Pass; 80 border-vs-collapse and 32 fall-vs-hazard text/site disagreements. |
| `check-achievements` | 48/429 never unlock; 12 labelled "possible" measure 0.2 %; only 210 in the 5–60 % band. |
| `check-names` | Pass. 4,315 entries, 4,027 distinct folded; pools 115–132 per district/gender. |
| Invariant harness (15 new arenas × 4 seeds + mutators, 60 Games) | No NaN, bad zones or unfinished runs; deterministic; JSON save/resume identical. Found stale roles (2,582 phase samples), stale leaders (67), dead-tribute plans (4,125), dead actors (3). |
| Horn harness (300 runs), stance/loner harness (400), death-mix harness (224), staleness harness (100) | See §5, §7, §10. |
| Playwright | Setup → reaping → chronicle → arena → sheet → palette → run-to-end → end → what-if → replay → HoF → How to play. No console errors; no horizontal page scroll at 380 px. |

---

## 3. Bugs

**P1** broken core behaviour / visible breakage; **P2** incorrect mechanics or misleading output; **P3** latent / maintenance.

### 3.1 Engine — arena, rules, combat

**E1 — P1 — Confirmed — Arena acts isolate zones.** `arenaDepth.ts:618-633` (`step.cutAround`): the never-strand guard checks only neighbour `n`, never `z` whose edges are all being cut. 52/60 frozen/toxic/tempest/ashfall/solar runs left a zone with no open edge; 3 trapped tributes (`acts-toxic-2`, Murky Waters). Fix: count open edges on both ends; stop cutting `z` at one remaining edge; add an invariant to `test:sim`.

**E2 — P2 — Confirmed — Act cuts reopen early, and restoring them deletes other systems' cuts.** Act cuts carry no tag, so `isReopenable` (`arenaRules.ts:310`) lets `tickOpeningEdges` (`map.ts:710`) reopen them (79 cycles in 60 runs). `arenaDepth.ts:608-611` removes every `actCuts` key from `severedEdges` even if a lockdown or pack re-cut it. Fix: an `actcut:` owner tag, checked in `isReopenable`; restore only edges the act still owns.

**E3 — P2 — Confirmed — `double-feasts` overrides feasts being off.** `gamesProfile.ts:274` forces `enableFeast = true` after the `no-feast` calendar wildcard (seeds nf-1/17/19 announce no feast, then hold 2–3) and after the user's own toggle (`simulator.ts:268-283`). Fix: multiply the cap only when feasts are enabled; surface "overridden by mutator" in setup if the mutator should win.

**E5 — P2 — Confirmed — Dead killers get live-killer lines.** `combat.ts:1962` (`killTribute`) and `checkDeath` (`:586`) credit `lastDamage.sourceId` when that tribute is already dead ("Vigil tackles Xiphias off a ledge…" a day after Vigil died, plus sponsor reaction). Fix: posthumous "died of the wounds X gave them" line; don't award sponsor/audience credit.

**E6 — P2 — Plausible — Weapon failure can kill the attacker mid-exchange and the fight continues.** `combat.ts:1081` → `wearWeapon` → `weaponFails` (`arenaDepth.ts:692-700`) deals 9 damage and runs `checkDeath` inside `landHit`, which then trains, adds fear/grudges and may `strikeDown(loser, winner)` with a dead winner. Fix: early return when the attacker is inactive; `isActive(winner)` before `strikeDown`.

**E7 — P3 — Plausible — "GROUND GIVES" collapse narrated when refused.** `arenaSignatureSetHippodrome.ts:403-417`: message and fall damage precede `collapseZonePermanently`, which returns false below 3 zones; latent edges still open. Check the return first.

**E8 — P3 — Confirmed (source) — Plans target a collapsed hidden-cache zone.** `arenaDepth.ts:746` `makePlan`. Skip fallen zones; choose cache zones that cannot fall.

**E9 — P3 — Confirmed — Dead tributes' plans are never pruned** (`arenaDepth.ts:729`; 4,125 phase samples in 60 Games). Bloats saves and rewind snapshots. Delete in `killTribute`.

**E10 — P3 — Confirmed (source) — Feint bonus applies against everyone.** `arenaDepth.ts:843` `deceptionEdge` gives +2 while any feint is live, including when the feigner attacks. Store the fooled ids; apply only when defending against them.

**E11 — P3 — Confirmed (source) — "The fog thins" for fog never shown** (whiteout/blackout suppressed it). `arenaDepth.ts` `tickWeather`.

**E12 — P3 — Confirmed (source) — Director taste and campaign arc apply under Vanilla rules.** `phases/pregames.ts:105-106`, `dayNight.ts:1861` (`capitolCruelty`), `sponsors.ts:171` contradict `gamesProfile.ts:280` ("the player's sliders, verbatim"). Gate on `vanillaRules` or document it.

**E13 — P3 — Plausible — `no-cornucopia` scraps ignore arena item laws and the forfeit Quell.** `phases/bloodbath.ts:334-337` uses raw `ITEMS`; apply `itemPoolFor` and the food-only filter.

**E14 — P3 — Confirmed — Cause text rules drift from site codes.** "Caught in the collapsing border" classifies as `collapse` (80 disagreements) and fall-vs-hazard (32). Match `border` before `collapse` in `causes.ts`.

**E15 — P3 — Confirmed — One arena death line leaks across arenas.** `rescueLine.ts:448` "Fell in The Cornucopia when the anchor went" — the most common named arena death text (12× in 224 runs, in unrelated arenas). Vary by arena `effectVocab`.

### 3.2 Engine — tributes, alliances, side systems

**T1 — P1 — Confirmed — Bloodbath runners are chased before anyone has died.** `phases/bloodbath.ts:746-805`: the run-down pass runs before the scrum, so `shortfall = 1` and catch = `max(…, shortfall × runDownFloor)` = 0.85 (`balance.ts:1967`), then a 3-round no-retreat ambush at 1.7× damage.

| gong decision | n | died at horn |
|---|---|---|
| horn | 3,210 | 24.3 % |
| edge | 2,396 | 28.3 % |
| flee | 667 | 57.7 % |
| wait | 327 | 57.8 % |
| ally (run to pact partner) | 215 | 57.7 % |
| freeze | 382 | 58.9 % |

Horn deaths as a share of deaths: confessor 44.7 %, forager 43.9 %, underdog 44.0 %, archivist 42.6 %, healer-pacifist 42.0 % vs Career 22.7 %. Fix: resolve the scrum first, chase only the remaining shortfall; cap runners at ~35 % of `deathTarget`; floor ∝ `shortfall² × proximity`; `runDownFloor` 0.85 → 0.35. Guard: flee death rate ≤ edge rate.

**T2 — P2 — Confirmed — Forced stances leave stale `shadowing`.** `stance.ts:853-864` (shock/grief early returns) and `forceStance` (`:761`) don't clear it; `isBeingFollowed` (`intent.ts:247`) and `pursuers` (`arenaDepth.ts:830`) still count them. Regression of the fix at `stance.ts:915`. Clear in `forceStance`.

**T3 — P2 — Confirmed — Friendly meals create food.** `encounters.ts:717-731` (truce meal, friendly non-allies) and `allianceBonds.ts:124` (greedy provider; `shortHunger` = 0) relieve hunger without consuming anything. Consume a food item (or the cache) or halve relief with no food.

**T4 — P2 — Confirmed — One-sided regard picks the encounter branch.** `encounters.ts:661` reads only `getRel(t, other)`, and the friendly branch precedes the aggressive branch, so a hunter who hates `t` is pulled into a shared meal. Use the min of both directions; skip if either is aggressive or hunting the other.

**T5 — P2 — Confirmed — Errands ignore real water and severed edges.** `intent.ts:69-80` `bestZoneFor` scores `terrain === water|wetland` (accepts brine sumps, rejects moor springs), never keeps the current zone, ignores `severedEdgeSet`, and reads true resources of unseen zones. Reuse `nearestZoneMatching` with `zoneFeatures(z).waterSource`.

**T6 — P2 — Confirmed — Target preference is still omniscient.** `archetypeHooks.ts:87-128` (via `objectives.ts:615`) reads live health, loot, injuries, downed, kills. Use `impressionOf`.

**T7 — P2 — Confirmed — Fleet has the wrong sign.** `data/traits.ts:267` `retreat: -0.06` (added at `combat.ts:928`) contradicts "Gets clear of a losing fight". Win rate 1.80 %. → `+0.08`.

**T8 — P2 — Confirmed — A failed watch still "keeps watch" and earns the streak.** `watch.ts:65-108`: after "falls asleep on watch" the code logs "keeps watch… Y sleeps" and bumps `watchStreak` (*Sleepless Week*). 23/50 failures. Skip the line and reset the streak.

**T9 — P2 — Confirmed — Downed tributes perform camp duties.** `allianceBonds.ts:145`, `watch.ts:34` filter by `status === 'alive'`. Medic/watch recovery lifts downed health above 0 without getting up (19/140 samples); downed tributes stand watch, provide, lead. Use `isActive`; route downed patients through rescue.

**T10 — P2 — Confirmed — Audience segments score victims as killers.** `audienceSegments.ts:38` falls back to `tributesInvolved[0]`; the rescue-window kill line (`downed.ts:249-253`) has no `actorId`, and "mercy withdrawn" double-counts a kill. Set `actorId`; count kills from typed death data.

**E4 — P2 — Confirmed — Stale roles disable duties and meals.** `allianceBonds.ts:103` `roles.quartermaster ?? muscle ?? leaderId` stops at a dead holder, so `shareMeal` returns; same for scout/medic (`:78-82`) and leader/camp (`:73`, `:147`). Roles are cleared on death only with a non-empty cache (`combat.ts:2203-2209`). `floor-pact-d5-male` had a dead quartermaster for 15 cycles. Reassign in `pruneDeadAlliances` / on exit; fall back to a living holder.

**E16 — P3 — Confirmed — Dead `leaderId` persists** a phase or more (67 samples, e.g. `career-pack-inv-saltworks-0` with 4 alive). Re-pick in `pruneDeadAlliances`.

**T11 — P3 — Confirmed — Rescue miss is sticky and immediate.** `obligations.ts:213` sets `rescueMissed` the first cycle the ally is seen down one hop away and never clears it, so a third-party rescue still breaks the promise (`:317`). Require 2+ cycles; clear when the ally gets up.

**T12 — P3 — Confirmed — Loners at convergence walk in afraid.** Only `huntAbandonFear` (70) gates the tier-99 hunt (`objectives.ts:331`); fear 45–69 still hunts over flee (tier 90). Use `fleeFear` for loners or subtract fear × 1.5 in `faceOffScore`.

**T13 — P3 — Confirmed — Provider trust inflates automatically** (`allianceBonds.ts:111-114`: a fair meal is a "kept" duty every cycle, +2 `roleTrustGain`), while a high-treachery provider hits `grudgeMotive` in ~2 cycles (0.79 greed chance). Roll duty against food presence; clamp greed at 0.5.

**T14 — P3 — Plausible — Remote zones and recruits judged on true data.** `objectives.ts:850` `nearestZoneMatching`, larder rung `:414`, `phases/alliances.ts:150` `needBasedPull` (reads full inventories).

**T15 — P3 — Confirmed — Eleven AUDIT-11 §16 traits are flat modifiers only** — Mimic, Cannon-Counter, Twitchy Trigger, Homebody, Forgets Faces, Oathkeeper, Salt-Tongued, Pack Rat, Night Owl, Bone-Setter, Heavy Sleeper have zero references in `src/engine`. No lure, accidental ally hit, first-camp defence, 2× grudge decay, or unbreakable promise.

**T16 — P3 — Confirmed — Name collisions in content.** `Fire-Walker` (earned, `traits.ts:796`) vs `Firewalker` (reaping, `:1156`). Near-duplicate quirks: "names their weapons"/"names their weapon" (`quirks.ts:1052/1103`), "never sits with their back to a door"/"…door or gap", "hoards string"/"hoards cordage", "keeps"/"wears a dead tribute's…", "sharpens the same stick"/"sharpens sticks while on watch".

**S1 — P2 — Confirmed — Prediction final-eight isn't de-duplicated.** `prediction.ts:73-79` and `gameStore.ts:755` `setPrediction` accept the same id eight times (8× `finalEightPoints` + exact-place bonus) and ids not in the cast; only `PredictionSlip.tsx:31` dedupes. Validate in the store and score a `Set`.

**S2 — P2 — Confirmed — Director signature→taste mapping contradicts itself.** `directors.ts:81-88`: `call-a-truce` → `alliance-breaker`; `seal-the-horn`, `cull-the-weak` → `mutt-lover`; `poison-the-wells` → `weather-obsessed`.

**S3 — P2 — Confirmed — Director tastes are below noise.** Multipliers 0.95–1.15. Widen to 0.6–1.8; guard each taste shifts its metric ≥ 2 sd.

**S4 — P3 — Confirmed — Two `Mutator`/`MUTATORS` exports** (`data/mutators.ts:18,24` deck vs `replayHooks.ts:52,59` presets). Rename the presets `Preset`/`PRESETS`.

**S5 — P3 — Confirmed — Mutator ids not de-duplicated** (`parseMutators` `mutators.ts:66-69`, `saveMigrations.ts:643`): `?mutators=blind-night,blind-night` fills both slots.

**S6 — P3 — Plausible — Audience mood freezes after a truncated save.** `audienceSegments.ts:33` `logMark` is an absolute index; `writeSave` log-tail fallback (`gameStore.ts:244-247`) makes `log.length < logMark`. Store the last read log id.

**S7 — P3 — Plausible — Follow-cam pins carry into the next Games.** `chronicleStore.ts` `pinnedIds`/`followOnly` survive `startGame`, and ids like `d3-male` are reused. Clear on seed change.

**S8 — P3 — Confirmed — 12 exported functions are never called:** `accusationAgainst`, `accusersOf` (accusations.ts:34, 257), `evaluateInRunNearMisses`, `achievementsAvailableIn` (achievements.ts:6535, 6558), `arenaBriefingLog`, `arenaMeanAcoustics` (noise.ts:109), `hasActs` (arenaDepth.ts:582), `lockedZones`, `isEnclosedIgnitionZone` (arenaRules.ts:383, 469), `isTributeDealt` (causes.ts:114), `obligationsOf` (obligations.ts:51), `significantWounds` (woundLedger.ts:58). Use or delete (see §11).

**S9 — P3 — Confirmed — 85 hard-coded knobs** remain in `undeclared-knobs-baseline.json` (e.g. `hunger < 40` in `alliance.ts`).

### 3.3 UI

**U1 — P1 — Confirmed — Gold hero bands and coins chip unreadable in dark mode** (AUDIT-11 U1 half-fixed). `.masthead-title`, `.chip-gold` use `var(--ink)` on gold (1.77:1); `.masthead-sub` 1.56:1 (`index.css:574-584`, `:841-845`). Setup, Reaping, End, HoF, header. Fix: theme-stable `--on-gold` / `--on-gold-muted`.

**U2 — P2 — Confirmed — Hero ghost numeral sits in flow.** `.masthead > * { position: relative }` (`index.css:556`) overrides `.masthead-ghost { position:absolute }` (`:542`); eyebrow shifted ~190 px, heroes ~480 px tall. Use `.masthead > *:not(.masthead-ghost)`.

**U3 — P2 — Confirmed — Tribute-sheet tabs show no selected state** (AUDIT-11 U18 half-fixed). `aria-selected` tabs (`TributeModal.tsx:755-760`, `SetupScreen.tsx:730`) but `.seg-item` styles only `[aria-pressed]`/`.is-active` (`index.css:753-754`).

**U4 — P2 — Confirmed — Tribute sheet cramped at 380 px** — tab labels run together, Compare squeezes the chip row, Sanity value truncated (`TributeModal.tsx:733-765`).

**U5 — P2 — Confirmed — Red Proceed buttons fail dark-mode contrast** (2.76:1): `GameScreen.tsx:991`, `ChronicleScreen.tsx:620`. Use `--on-red` / `btn-primary`.

**U6 — P2 — Plausible — Scroll position carries across screens** (only `ChronicleScreen.tsx:358` scrolls). `scrollTo(0,0)` on view change in `App.tsx`, except deep links.

**U7 — P2 — Confirmed — Two features named "Mutators"** (`SetupScreen.tsx:797` presets vs `:1376` deck). Deck cards show only a name; the rest disable silently at 2; "Draw 2" replaces picks silently.

**U8 — P3 — Confirmed — Blue "Pack" alliance chip 2.78:1 in dark mode** (`allianceAccent`). Per-theme alliance tokens.

**U9 — P3 — Confirmed — Palette "Jump to the next death"** goes to the first death when unfocused and repeats the last (`CommandPalette.tsx:128-140`).

**U10 — P3 — Confirmed — Palette offers "Resume the autosaved run" for the current run** and the current view (`CommandPalette.tsx:146-155`).

**U11 — P3 — Confirmed — "Hold the reaping" right after "Confirm tributes"** (`ChronicleScreen.tsx:63`).

**U12 — P3 — Confirmed — "Living only" checkbox renders as a 44 px box** (tap-target rule on the input, `index.css:1547-1553`); put the target on the label.

**U13 — P3 — Confirmed — End and What-if keep `#/arena`** and highlight "Arena"; no reloadable debrief address.

---

## 4. QOL, UI and UX improvements

**High**
- Dark-mode token pass (`--on-gold`, `--on-red`, per-theme alliance colours) plus a Playwright contrast check in `test:ui`.
- Compact mobile masthead (~160 px) after the U2 fix.
- Mobile tribute sheet as a bottom sheet: sticky, horizontally scrollable tabs; Compare in an overflow menu.
- "Skip to the gong" in the pre-arena chronicle (ten clicks today); clearer stage labels.
- One pane switcher on mobile — hide the in-page Standings/Map/Roster switcher below `lg` (bottom nav already does it).

**Medium**
- Scroll reset + heading focus on route change; `#/debrief` route.
- Mutator UX: rename presets "Quick presets", show blurbs on deck cards, "2 of 2 picked" note, show active mutators on reaping and broadcast bar.
- Audience segments visible outside the tribute sheet: a "loudest segment" chip on the sponsor booth/broadcast bar.
- What-if: default to the victor's closest call, selectable branch count (8/16/32), label no-victor branches, link alternative winners to sheets, state the 16-phase rewind window.
- Palette: group rows (Actions / Tributes / Sectors), mark the current view, show the death count in "next death".
- Standings on mobile: pin the Tribute column or add an edge fade.

**Low**
- Colour-blind check for the alliance palette.
- Live "almost unlocked" achievement hints after the victor is decided (wire `evaluateInRunNearMisses`, spoiler-gated).
- Death-mix tile on the run profile ("this Games vs your average").

---

## 5. Tribute logic — robustness and complexity

- **Horn plans** (with T1): a pre-gong choice (grab-and-go / edge scatter / straight run) scored on plate distance, archetype caution and pact partner, so the gong is a decision rather than a dice roll.
- **Loner fear curve at convergence** (T12): hide, ambush or parley instead of a forced hunt.
- **Commitment by caution:** cautious tributes keep a `reach` objective through minor threats rather than re-rolling each cycle; reckless ones switch eagerly.
- **Errand dependency queue** (T5): food → water → goal via `nearestZoneMatching` and remembered barrenness.
- **Belief-only decisions end to end** (T6, T14): every scoring function takes `impressionOf`/memory, never live state; add an `omniscience` lint-style check in `check-decisions`.
- **Hunger that bites** (T3, A12): zone depletion (forage decays with visits, regrows over 3 days) so starvation reaches 1–2 % and rationing becomes a real choice.
- **Make the §16 traits real** (T15): Mimic lure event, Twitchy Trigger ally-hit roll in crowded fights, Homebody first-camp defence bonus, Forgets Faces 2× grudge decay, Oathkeeper cannot break promises (and suffers for it), Heavy Sleeper watch-fail multiplier, Bone-Setter self-splint.
- **Earned traits that distinguish victors:** Bloodied is on 96/100 victors and Unbroken on 88 (`earnedTraits.ts`). Tighten thresholds or tier them (Bloodied I/II/III).

## 6. Relationships and alliances

- Fix E4/E16/T9/T13 first — role holders must be living and active; duties must be rolled, not assumed.
- **Per-pair fairness ledger** (holder, provider) so a grudge survives a role change.
- **Watch rota ordered by `awarenessNight`**; a failed watch opens a betrayal/theft opportunity for the most treacherous member.
- **Witnessed deceit feeds suspicion:** a seen mimic lure or food theft raises `suspicionOf`.
- **Loner support:** loners win 1.47 % vs 6.61 % for ever-allied tributes. Add truce chains and a one-off "shared camp" pact (a night's truce with a shared watch) so the Hermit/loner premise is playable.
- **Splinters:** a 4+ alliance can split into two named factions on a trust divergence (reuses factions from AUDIT-11 §6).
- **Hollow victory:** killing a former ally costs sanity and follows the killer (event U26 below).
- **Cross-Games rivalries:** persist surviving `memory.rivals` pairs (`epilogue.ts:69`) as district feuds; send a Grudge Match veteran (`gameStore.ts:1293`) in as a named nemesis.

## 7. Trait, archetype and skill balance

1,000-run metrics; 800-run `diagnose-archetypes`; 400-run stance harness; cohorts at 150 pairs. **Fix T1 and T7 first and re-measure at 1,600 runs** — T1 alone should lift most of the bottom group.

**Archetypes** (win %): tracker **9.01** (n 333), mercenary 7.42, career 7.32, wildcard 6.80, trickster 6.64, herald 6.64 … scholar 3.66, diplomat 3.60, healer-pacifist 2.91, confessor 2.77, **hermit 1.74**. Field spread 5.18× vs 2.3× goal. Matched cohort: Career → tracker adds +0.82 days [0.08, 1.56].

**Stance** (dominant, win %): Evasive 4.0 % (n 3,403), Defensive 5.1, Aggressive 9.1, Fortified 13.8, Scavenging 19.6 (n 219). Time share: Evasive 34.5 %, Aggressive 24.0 %, Patrolling 1.4 % (goal ≥ 1.5).

**Districts:** D1 14.7 %, D2 15.1 % (goal ≤ 15 %), D4 13.7 % … D8 4.9 %, D11 3.6 %. Storied tier 7.4 % vs thin 4.1 %.

**Reaping traits** (n ≈ 130–190, leads): over — Grips Hard 12.4, Cinder-Handed 10.7, Thrifty 9.9, Hollow Leg 9.9, Horse Trader 9.4, Heavy Bones 8.9; under — Evidence-Hungry 0.68 (no modifiers at all), Fire-Shy 0.78 (penalties only), Open Hand 1.31, Salt-Tongued 1.55, Fleet 1.80, Venom-Blooded 1.83, Long Wind 1.99. Outlier modifier magnitudes: Waterborn 3.4 sd, Slow Burn 2.9, Dead-Eyed 2.8, Quiet Room 2.7, Ruthless 2.6, Paranoid 2.5.

| item | where | current → proposed |
|---|---|---|
| Runner catch floor | `BLOODBATH.runDownFloor` | 0.85 → 0.35, pass after scrum |
| Fleet | `traits.ts:267` | retreat −0.06 → +0.08 |
| Grips Hard | traits | unarmedPower 1.5 → 1.0 |
| Cinder-Handed | traits | burnOnHit 0.10 → 0.07 |
| Thrifty / Hollow Leg | traits | drain −3 → −2 |
| Evidence-Hungry | traits | + `{ suspicionResist: 0.25, awareness: 0.3 }`; immune to false rumours |
| Fire-Shy | traits | + `{ awareness: 0.2, retreat: 0.04 }` |
| Open Hand | traits | capacity −1 → 0, rapport 0.4 → 0.5 |
| Salt-Tongued | traits | rumourCredibility −0.2 → −0.1, + persuasion 0.1 |
| Waterborn / Slow Burn | traits | scale all mods × 0.7 |
| tracker | `archetypes.ts` | stealth bias 2 → 1; `objectiveBias.hunt` 0.5 → 0.35 |
| hermit | archetypes | charisma −2 → −1; endurance 2 → 3; horn fight −0.15; implement Homebody |
| confessor | archetypes | `stanceBias.Desperate` 0.8 → 0.3; aggression −0.35 → −0.2 |
| healer-pacifist | archetypes | +0.1 retreat when unarmed; full caution at the horn |
| provider greed | `allianceBonds.ts:107` | clamp 0.5; `shortHunger` 0 → 4 after T3 |
| district skew | balance | thin-tier sponsor floor, or a D8/D11 skill head start |

Also: bare-hand kills are 24.7 % of tribute kills though 84 % of the living are armed — check weapon selection in melee.

---

## 8. Arenas — robustness and complexity

**Generic**
1. **Stop the border doing the arena's job.** Border deaths dominate the lowest tribute-kill arenas (culdesac 18, canopyweb 18, canopy 20, carnival 19, quarry 23 of ~92). Cap border kills per Games (~2); after the cap the closing sector fires that arena's own hazard.
2. **Signature-death guard:** tag authored lethal events `signature: true`; ≥ 8 % of non-tribute deaths per arena from its own causes.
3. **Tribute-kill share band 50–72 %** per arena (concrete, kelvin, redcathedral, gallery, opencut sit at 72 %; canopy/carnival at 52 %).
4. **Hazard telegraphs:** `warnText` on `ArenaEventDef` one cycle ahead; Watchful / Reads-the-Sky get a dodge bonus.
5. **Zone depletion** (see §5).
6. **Scarce water for the 17 waterless arenas** (toxic, tempest, saltflats, warren, reef, abattoir, ashwaste, floe, seapeaks, ashgrove, kelvin, menagerie, gallery, circuit, wardblock, hippodrome) — condensate tap, meltwater drip, coolant line — each with a risk.
7. **Mutt roster floor of 4** (canopyweb, craterfield, seapeaks, acousticforest, burnscar, saltflats and 8 procedural biomes have 3), enforced in `validate-arenas`.
8. **Off-season skins** for gallery, malthouse, circuit, wardblock, glasshouse.
9. **Strand invariant** (E1) in `validate-arenas`/`test:sim`: every live zone keeps ≥ 1 open edge unless it is being deliberately sealed with nobody inside.
10. Put `lockedZones` and `isEnclosedIgnitionZone` to work: lockdown UI state and smoke deaths in enclosed ignition zones.

**Thin arenas** (own authored events / unique causes / mutts / ambient): redcathedral 33/23/5/8 · culdesac 33/24/4/8 · ashgrove 33/24/4/8 · silkwood 35/24/5/8 · cabin 33/24/4/12 · menagerie 35/25/7/8 · karst 35/25/4/12 · magmatube 33/26/4/12 · quarry 33/27/5/8 · labyrinth 43/27/4/8 · nooneplace 42/27/5/8. Mid (28–33 causes): tempest, canopyweb, craterfield, frozen, toxic, glacier, alpine, terraces, seapeaks, kelvin, storywood, sporefields, abattoir, carnival, ashwaste, floe, acousticforest, burnscar, solar, ashfall, canopy, vault, islands, reef, concrete, eclipse, clockwork, saltflats. Rich (36–42): saltworks, kiln, tidewrack, thresher, warren, malthouse, circuit, wardblock, vigil, glasshouse, undercroft, vintage, cinderpeak, opencut, gallery, hippodrome. Every arena also draws 132 universal + 24 group-6 + 30 generic events and 4 pack set pieces.

**Per-arena mechanics for the thinnest**
- **Red Cathedral:** hour-strike bell cycle; crypt floods at vespers; votive candles ignite the nave.
- **Cul-de-Sac:** houses that "close" in turn (extend Number 14); sprinkler timers; garage-door cycle; gas main.
- **Ashgrove Secondary:** bell periods that open/close zones; fire drill locks doors; PA broadcasts positions.
- **Silk Wood:** web tension lines that reveal movement; cocoon caches; silk tightens as it dries.
- **Snowbound Homestead:** a finite woodpile; chimney fire; the well freezes; roof snow load.
- **Menagerie:** enclosures unlock by phase; keeper's keys; feeding time.
- **Undermere:** sumps that fill with surface rain; air pockets; cave-dive lines.
- **Throat of the Mountain:** lava-tube skylights; gas pockets; cooling crusts.
- **Vertical Quarry:** scheduled blasting; spoil slides; ore buckets.
- **Labyrinth / No-One Place:** the AUDIT-11 briefs are still pending — dead ends that rearrange, a place that forgets who entered.

---

## 9. More ways to die

Format: cause text — code — trigger. None repeat AUDIT-11 §9 or existing causes.

**Universal (26)**
1. Bitten by a snake in the undergrowth — poison — forage in forest/wetland, failed perception.
2. Stung by a nest of hornets — shock — Allergic/Fragile tribute disturbs a hive while hiding.
3. Drank from a still pool gone foul — infection — dehydration band ≥ 2, no purifier, stagnant water.
4. Crushed under a falling tree in the wind — collapse — storm front + forest.
5. Swept away fording a swollen stream — drowning — day after rain, water-edge crossing while exhausted.
6. Broke through thin ice — hypothermia — cold arena, water crossing after a thaw day.
7. Buried under a mudslide — asphyxiation — rain + highland slope.
8. Fever from a broken tooth — sepsis — face wound untreated 4 days.
9. Walked into their own snare in the dark — trap — returns to own trap at night without Night-Sighted.
10. Throat cut in their sleep by a tribute they had spared — tribute — mercy on record, target resting unguarded.
11. Fell asleep on watch and never woke — hypothermia — Exhausted + night watch in a cold zone.
12. Gored by a feral boar while hunting — hazard — hunt action, low combat, forest/grassland.
13. Knife slipped gutting a catch — bleeding — hunt success, Clumsy or low sanity band.
14. Flash flood in a dry gully — drowning — desert/badlands after a rare storm.
15. Burned up with fever from a bad cut — infection — wound + heat stress.
16. Went mad and walked into the dark — exposure — sanity 0, night, alone 2+ days.
17. Heart gave out after the bloodbath sprint — shock — low endurance, sprint on day 1.
18. Poisoned by a "feast delicacy" — poison — feast attended, high Gamemaker agency.
19. Crushed by a supply crate that fell badly — machinery — drop lands on the tribute (rare).
20. Spear they could not pull free — tribute — spear melee in a crowded zone (3+).
21. Hanged in their own climbing rope — fall — rope item, climb while Exhausted.
22. Bled out from a sponsor's needle given badly — bleeding — medicine gift, low medicine skill.
23. Suffocated in a collapsed snow shelter — asphyxiation — crafted shelter, cold arena, snow load.
24. Choked on smoke hiding in a hollow — asphyxiation — hide action where a fire started.
25. Killed by a hallucinating ally — tribute — ally in sanity band 0, same zone at night.
26. Stepped on a landmine left from a past Games — gamemaker — ruins/open zone, campaign has earlier Games.

**Arena-specific (3 each)**
- **Red Cathedral:** caught in the bell rope as it swung (fall, belfry, hour-strike) · drowned in the crypt at vespers (drowning, crypt, evening) · burned when the votive rack went up (burns, nave, candle event).
- **Cul-de-Sac:** crushed under the garage door (machinery, timed cycle) · blown up by the gas main on Maple (burns, kitchen, fire nearby) · drowned under the pool cover (drowning, night, pool).
- **Ashgrove Secondary:** locked in during the fire drill (asphyxiation, stairwell) · burned in the chemistry lab (burns, crafting action) · crushed when the bleachers folded (collapse, gym, 3+ present).
- **Silk Wood:** strangled when the silk dried tight (asphyxiation, cocoon rest after a dry day) · web line snapped (fall, heavy load) · wrapped and drained by the spinners (mutt, night).
- **Snowbound Homestead:** roof gave under the snow (collapse, day 3+, barn) · chimney fire (burns, fire lit without clearing) · froze fetching wood at night (hypothermia, woodpile empty).
- **Menagerie:** trampled at feeding time (collapse, paddock) · taken by the big cat from an open enclosure (mutt, unlock phase) · sickened from the keeper's feed stores (poison).
- **Undermere:** the sump filled (drowning, surface rain) · lost the line in the flooded passage (drowning, low intelligence) · dead air pocket (asphyxiation, resting deep).
- **Throat of the Mountain:** fell through a cooling crust (burns, day after eruption) · gas in the tube (asphyxiation, vent event) · skylight collapse (collapse, quake).
- **Vertical Quarry:** swept off the ledge by blasting (fall, blast cycle) · buried in a spoil slide (collapse, rain) · runaway ore bucket (machinery, cable zone).

## 10. More events

**Universal (26)**
1. **Dead drop** — a note names a tribute's location; true 60 %, else a Gamemaker plant.
2. **Wrong parachute** — a gift for someone else lands nearby: keep, return (+rapport), or trade.
3. **Borrowed shelter** — a warm abandoned shelter; occupying it reveals you to its owner.
4. **Cache map** — a scrap points to a second cache; needs a Cartographer/Tracker to read.
5. **Mirror sky** — the sky shows one tribute's position to everyone for a cycle.
6. **Silent cannon** — a cannon with no death; paranoia checks in alliances.
7. **Letter from home** — willpower up, stealth down while reading.
8. **The long shadow** — a mutt stalks one tribute for 3 cycles, attacks if they rest alone.
9. **Ration audit** — the alliance counts food; low trust → hoarding accusation.
10. **Crossing toll** — a tribute holds an edge and demands items.
11. **False truce flag** — a white cloth: honest or bait (Baiting stance).
12. **Fever camp** — two infected tributes share a zone; nursing check or contagion.
13. **Echo** — a shout carries into every adjacent zone (noise system).
14. **Lost weapon** — a rival finds a dropped weapon; its owner recognises it.
15. **Anthem at noon** — an unscheduled anthem replays the fallen; morale shifts.
16. **Rationed rain** — rain in one zone only; everyone converges.
17. **Crows gather** — carrion birds circle a body; anyone nearby is revealed.
18. **Night swap** — two sleepers wake in each other's zones.
19. **Traded secrets** — two rivals exchange information about a third.
20. **Splinter** — a 4+ alliance splits into two named factions.
21. **Burial** — a tribute buries an ally: willpower up, a cycle lost.
22. **Sponsor dare** — a gift only if the tribute performs (a public kill, a speech).
23. **Snare harvest** — snares catch food (Trapper payoff).
24. **Last-stand pledge** — two allies swear to fight together; shared composure.
25. **Knife in the ration** — a gift hides a blade and a message.
26. **Hollow victory** — killing a former ally costs sanity.

**Arena-specific (6 each for the thinnest)**
- **Red Cathedral:** vespers bell (zone-wide sanity) · the confessional (secret revealed) · rose window shatters · crypt-flood chain (setup → rising → sealed) · choir voices (mimic mutt) · relic cache.
- **Cul-de-Sac:** sprinkler clock · ice-cream-van jingle lure · garage roulette · the house that invites one tribute in · street-by-street power cut · neighbourhood-watch camera chain.
- **Ashgrove:** bell periods switching open zones · fire drill · locker cache · PA roll call · gym dodgeball mutt swarm · principal's office safe.
- **Silk Wood:** web harp (vibrations reveal positions) · cocoon cache · dew morning (lines go slick) · spinner nest chain · silk-bridge weaving (crafting) · moth swarm.
- **Snowbound Homestead:** woodpile count · frozen well · blizzard lock-in (everyone indoors in one zone) · pantry raid · wolf at the door · thaw-drip water.
- **Menagerie:** feeding bell · keeper's keys · aviary release · reptile-house heat failure · petting-zoo trap · lion-walk chain.
- **Undermere:** sump rise · lantern-fish light · echo sounding · flooded-passage chain · blind cave fish (food) · air-pocket rest.
- **Throat of the Mountain:** skylight sun · eruption day · obsidian blades (crafting) · gas-vent chain · cooling-crust crossing · magma glow (no true darkness).

**Staleness fixes that need no new content**
- Give the fixed beats that fire in 99–100 % of runs (gong, "# cannons mark the end of the bloodbath", "the Capitol is talking about…", "last tribute from District #", "Something in {T} goes quiet…", "stops pretending to forage and starts hunting", district-partner cannon, rivals' truce) pools of 4–6 variants through the recent-lines filter (`context.ts:200-228`).
- Per-district reaping, token and family lines (`data/pregames.ts:13-30`) are single fixed lines — give each district 4+ variants.
- Promote the AUDIT-11 §10 events that shipped as single-tribute lines into real mechanics: Bidding War (two tributes contest a parachute), Paranoia Night (fogs sightings, ally can be hit), Truce of the Wounded (heals both), Old Victor's Cache (the real HoF victor's items), and arena-wide multi-day chains.

## 11. Side features

- **Prediction:** fix S1; add a first-death-cause pick and a "day the Games end" over/under; a streak and bankroll across saves (feeds *Parlay*, *Called It*).
- **Side markets:** death cause (arena vs tribute), first mutt kill, border casualties, settled from `deathCodeOf`.
- **Directors:** fix S2/S3; 2–3 authored signature interventions each (mutt-lover releases the rarest mutt on day 5; fire-lover scars a zone); a run-profile line "director effect: +X mutt deaths vs baseline".
- **Mutators:** fix S4/S5/E3/E13. Grow the deck from 6 to ~14 — mutts-only kills count (AUDIT-11 §12, still missing), water ration, one-way edges, silent cannons, no night, wounded start, sponsor auction, border doubles — with an incompatibility table and a gauntlet mode that scores mutator stacks into the Hall of Fame.
- **Audience:** feed segment heat into `gamemakerAgency.ts:138` instead of the single `audienceInterest` (bloodthirsty crowd → mutts, romantic → feasts); give `audience.ts` decay.
- **Gamemakers:** tie interventions to the fairness guard with a visible cruelty meter.
- **Sponsors:** bidding wars between blocs; arena-logical gifts (condensate filter in waterless arenas); "patron's regret" lowers a bloc's generosity when its tribute dies within a day.
- **Mentors:** today a past-victor mentor changes only generosity and pull (`mentors.ts:81,88`). Give them a measurable in-arena effect (a skill tip, a warning about their own arena type) and notes in their voice.
- **Apprenticeship:** let the player choose which skill `offerApprenticeship` (`apprenticeship.ts:37`) passes on, stored for that district's next reaping.
- **Reunions:** reunion and veteran scenes (`reunion.ts:32,75`) should write to the campaign and alter the next reaping.
- **Quells a season ahead:** record the rebellion Quell in `CampaignSnapshot` one Games early (`gameStore.ts:1211-1215`) so it can be planned for.
- **What-if:** "X was never reaped" (swap in a reserve) and "this alliance never formed" branches, reusing intervention replay (`whatIf.ts:62`).
- **Off-season:** skins for the 5 missing arenas; an arena museum replaying each arena's signature deaths; victor tours to the districts of those they killed.
- **Victor records:** per-victor kill ledger (who and how), arena mastery across the campaign, scar questions in the interview via `significantWounds`.
- **replayHooks:** daily seed with a fixed mutator pair and a shareable slip; a weekly arena rotation weighted toward thin arenas so new content is seen.

## 12. Replayability

Staleness harness (100 runs, all arenas, first-session recent-lines memory): 1,892 lines/run (589 headlines); 62,451 distinct templates; 343 appear in ≥ 50 % of runs (100 of them headlines); within-run repeats 28.7 % mean (p90 32.0 %). Run length mean 11.97 days, sd 2.66 (7–23). 33 of 40 archetypes won at least once; top archetype 7 %. Victor profile: outlying district with 1–3 kills 43 %, outlying 4+ 25 %, Career 1–3 17 %, Career 4+ 12 %, no kills 3 %.

1. **Rotate the fixed beats** (§10) — the cheapest large win.
2. **Seasons as a campaign mode:** Quell announced a season ahead, a mutator drawn for the next season, reunions and apprenticeships carried forward.
3. **Cross-Games rivalries and nemeses** (§6).
4. **Arena-level story chains** spanning three days, extending `state.eventChains` (`encounters.ts:276`) beyond per-tribute links, with progress stored in the campaign.
5. **Director personalities that visibly play differently** (S3) — the director becomes a reason to replay.
6. **Scored variant play:** gauntlet mutator stacks, daily seeds, weekly thin-arena rotation, prediction streaks.
7. **Distinguish victors** with tiered earned traits and kill ledgers, so a win reads differently each time.
8. **Called the upset:** reward predicting a no-kill or thin-district victor (3 % of victors today).

## 13. Shallow or incomplete features

| Feature | State | Evidence |
|---|---|---|
| AUDIT-11 §16 traits (11) | Flat modifiers; promised behaviour missing | T15 |
| Audience segments | Feed only the player's sponsor price; no decay; boredom reads a separate `audienceInterest` | `playerSponsor.ts:6`, `gamemakerAgency.ts:138`, `audience.ts` (20 lines) |
| Directors | Tastes within ±15 %; contradictory mapping | S2, S3 |
| Mutator deck | 6 cards; "mutts-only" missing; no incompatibility checks | `mutators.ts:25-30` |
| Apprenticeship, reunions, mentors | Headline-only; nothing persists or changes play | §11 |
| What-if | Only salt reruns from the last 16 phases | `whatIf.ts:62` |
| §10 events | Single-tribute text lines, except Arena Shrink Pulse | `group6.ts:603-657` |
| Skills | Animal handling missing; navigation/cooking/deception/watchkeeping reuse old names | `proficiency.ts:78-81`, `types.ts:227-240` |
| Traps | 1 death in 3,616; no food yield | A12 / §9 |
| Starvation / water | 0.1–0.2 % / 1.0–1.4 % of deaths; 17 waterless arenas play like the rest | T3, §8 |
| Earned traits | Bloodied 96 %, Unbroken 88 % of victors | §5 |
| Unused exports | 12 never called; ~95 used only in-file | S8 |
| Rare beats | expulsion 0.7 %, treaty-outgrown 3 %, waterborne-illness 3.3 %, parachute-lost 3.7 %, rival-thaw 4.7 % of runs | `check-coverage` |

## 14. Achievements

**Maintenance:** run `npm run fix:rarity` to relabel from measured rates; the 12 labelled "possible" at 0.2 % are no-beast-touched-them, front-loaded, no-victor, forgotten-district-crowns-one, never-left-the-horn, d-not-a-free-ride, full-table, nothing-left-to-give, a7-unsponsored, a8-two-grades-down, a8-every-site, signal-fire. Of the 48 never unlocked (loners-handshake, walked-the-perimeter, starved-out, seen-nothing, bloodbath-massacre, sky-of-cannons, the-short-week, every-persona, twelve-levers, the-carpenter, 14 `a7-*` such as scored-one, scored-twelve, four-scars, five-health, came-back-from-the-floor, stripped-the-crown), several depend on systems this audit fixes (T1, T3, Patrolling stance) — re-measure after those fixes, then retune or retire.

**New (22)** — titles checked against `achievements.ts`:
1. **Taxonomist** (meta) — 20 distinct cause codes seen across saved Games.
2. **Held Breath** (survival) — victor dodged an asphyxiation-coded hazard.
3. **Parlay** (meta) — correct victor pick on 3 consecutive slips.
4. **Called It** (games) — a slip scores ≥ 80 % of maximum (after S1).
5. **Cold Open** (games) — the first death is not by a tribute.
6. **Borrowed Fire** (survival) — victor used an abandoned camp and was never ambushed there.
7. **Dead Air** (oddity) — 2 full days with no cannon after day 4.
8. **Every Way Out** (arena) — 8+ distinct cause codes in one Games.
9. **Second Cache** (arena) — a hidden-cache finder wins.
10. **Scarred Ground** (arena) — victor spent a day in a zone flooded, burnt or collapsed that day.
11. **Long Shot** (reaping) — victor had the lowest pre-Games odds.
12. **Hollow Horn** (games) — won under `no-cornucopia` with 0 bloodbath kills.
13. **Stormchaser** (arena) — victor survived 3+ weather fronts.
14. **Ninth Life** (survival) — victor downed 3 times and recovered each time.
15. **Last Rites** (social) — a tribute buries an ally and later wins.
16. **Unmoved** (oddity) — victor never left their starting zone.
17. **Fed by Foes** (social) — victor received food from another alliance.
18. **Rust and Ruin** (arena) — victor survived an infection in a rust-bearing arena.
19. **The Keeper's Key** (arena) — Menagerie won by someone who opened an enclosure.
20. **Wrong Turn** (arena) — a Labyrinth tribute dies in a dead end the victor escaped that day.
21. **Airlock** (arena) — Kelvin-9 victor sealed a bulkhead on a rival.
22. **Once Upon a Time** (arena) — Story Wood victor survived three fairy-tale tableaux.

## 15. Names (single given names only)

Pools: 115–132 per district/gender (shallowest D5 Female 115, D6 117/117). Initial-letter spread 4.1:1 (S 371 vs Z 90). D9 carries D11 growing-season names (Millet, Barley, Rye) — move them. Themed district vocabulary is close to exhausted; future growth should favour neutral/cultural sets, which also help the under-used initials I, O, U, V, Z.

178 new names, each verified by script as absent (case- and accent-folded) from every pool and unrepeated here:

- **D1 (14):** Aurelle, Citrine, Chatoyant, Moonstone, Oriane, Ambrine, Lucienne, Perlina, Orsolya, Ottavia, Kunzite, Spinel, Morganite, Lazulite
- **D2 (14):** Corbel, Gabbro, Dolomite, Travertine, Dressel, Arkose, Breccia, Porphyr, Buttress, Gargoyle, Castellan, Merlon, Crenel, Parapet
- **D3 (16):** Capstan, Rheostat, Tappet, Varistor, Triode, Pentode, Bushing, Grommet, Ratchet, Flange, Spline, Arduin, Lathe, Tensor, Vernier, Trimpot
- **D4 (16):** Winkle, Scallop, Limpet, Brill, Cockle, Garfish, Pilchard, Bonito, Snook, Mackerel, Anchovy, Turbot, Skate, Nerita, Coquina, Murex
- **D5 (6):** Fulgor, Tesselle, Ohma, Kilovolt, Argon, Krypton
- **D6 (10):** Coupler, Caboose, Switchback, Tender, Axlet, Shunter, Draisine, Railer, Bogie, Flatcar
- **D7 (13):** Hornbeam, Tupelo, Catalpa, Buckeye, Sassafras, Chinquapin, Paulownia, Deodar, Cedrine, Kauri, Totara, Rimu, Karri
- **D8 (2):** Selvage, Loden
- **D9 (9):** Mashlum, Oatlet, Maslin, Bulgur, Freekeh, Triticale, Fonio, Haycock, Groat
- **D10 (8):** Heifrin, Dewlap, Fetlock, Tether, Belted, Cheviot, Texel, Romney
- **D11 (13):** Pippin, Russet, Loganberry, Espalier, Bramley, Codlin, Nonpareil, Reinette, Costard, Pearmain, Tayberry, Boysen, Salal
- **D12 (9):** Tipple, Culm, Bituma, Lignite, Shaftman, Onsetter, Sumpman, Headframe, Winder
- **Neutral (48):** Ilse, Ivo, Odile, Pim, Soren, Una, Vesna, Wystan, Zelie, Anouk, Dagny, Eero, Ailsa, Birgit, Dorit, Elio, Fiorella, Ingrid, Jorun, Kasimir, Liesel, Mirela, Nils, Oksana, Paavo, Ragna, Sigrun, Tove, Vidar, Zdenka, Aino, Bertil, Cilla, Dusan, Eilif, Frode, Gerda, Ines, Jarle, Kaija, Leif, Noor, Olavi, Pirkko, Runa, Svea, Taavi, Veikko

## 16. New traits, skills, archetypes, quirks, stances

**Traits (10)**

| trait | modifiers | engine hook |
|---|---|---|
| Plate-Sprinter | retreat 0.05, hornCommitment −0.3 | −40 % horn run-down catch |
| Scar-Reader | awareness 0.2 | `impressionOf` shows true injury state of anyone seen fighting |
| Rationer | hungerDrain −1.5, rapport 0.1 | as provider never greedy; a meal uses half an item |
| Cornered Rat | — | combatPower +1.5 below 30 health after a failed retreat |
| Echo-Blind | awarenessNight −1, concealment 0.05 | — |
| Rumour-Monger | rumourCredibility 0.3, trustGain −0.1 | `tradeRumours` always passes one claim |
| Long Memory | vengeanceEdge 1, griefResist −0.1 | — |
| Last-Light | nightMovement 0.6, fatigueNight 2 | — |
| Knot-Tier | trapSkill 0.08 | traps also catch food |
| Crowd-Shy | sponsorAppeal −0.8, concealment 0.08, targetDraw −0.5 | — |

**Archetypes (5)**
- **Scout-Runner** — caution 0.3, Patrolling bias 0.8; signature: brings an ally a sighting that prevents an ambush (lifts the rare Patrolling stance).
- **Turncoat** — treachery 0.4, allianceAffinity 0.4; signature: a timed betrayal that inherits the cache and roles.
- **Warden-of-the-Weak** — protect bias 0.6, targets the strongest; signature: stands between a downed ally and the killer (`rescueLine`).
- **Forger** — crafting-led; signature: crafts a weapon from zone materials, with durability.
- **Gambler** — escalating risk curve, reads odds; signature: picks a < 40 % fight the sponsors paid for, and a parachute follows a win.

**Skills (7)**
- **Evasion** — trained by successful retreats; +0.02 retreat and −5 % run-down catch per level.
- **Rationing** — reduces drain; trained by eating on low stock.
- **Scavenging** — better loot from corpses and camps; used by the Scavenging stance.
- **Salvage** — opens locked caches and rigged containers.
- **Signalling** — alliance reunion speed; the courier signature.
- **Ambush** — trained by the Shadowing payoff; ambush damage, lower detection.
- **Animal handling** — the missing AUDIT-11 skill: mutt deterrence, Menagerie enclosures, hunting yield.

**Quirks (6)**
- counts the plates before the gong — retreat 0.03
- eats the rind too — hungerDrain −0.8, poisonResist −0.05
- never sleeps in the same spot twice — awarenessNight 0.3, fatigueNight 0.8
- hums when lying — suspicionResist −0.1
- wraps wounds too tight — bleedResist 0.05, medicine −0.03
- whispers to the wind before moving — nightMovement 0.2, concealment −0.01

**Stances (2)**
- **Hiding** — conditional (high concealment, threats near); untargetable by hunts unless tracked; costs hunger and thirst each cycle. A real loner alternative to Evasive.
- **Parleying** — conditional (hostile present, low risk tolerance); forces `tryParley` first; each failure raises fear.

---

## 17. Suggested order of work

1. **Batch A — core correctness:** T1, E1, E2, E4/E16, T9, T3, T7, T8, E5, E3, S1. Add invariants: no stranded zones, living/active role holders, flee rate ≤ edge rate, no posthumous kill lines.
2. **Batch B — UI:** U1–U7, then §4 High.
3. **Batch C — re-measure balance** at 1,600 runs, then apply §7.
4. **Batch D — make shallow systems real:** T15 traits, directors S2/S3, audience → Gamemakers, mutator deck growth, apprenticeship/reunion/Quell persistence.
5. **Batch E — content:** beat rotation (§10 staleness), thin-arena mechanics/deaths/events (§8–10), water and mutt floors, new names, achievements, traits/skills/archetypes/quirks/stances.
6. **Batch F — replayability:** campaign mode, rivalries, story chains, variant play.
