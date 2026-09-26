# Survival Games — AUDIT-13: current-code audit and expansion plan

Audited revision: [`55ee5f2`](https://github.com/icamcmusic-ship-it/survival-games/tree/55ee5f2) (merge of #102). Audit date: 26 September 2026.

This is an audit and backlog. No production source was changed. **Confirmed** means reproduced by execution (seeded harnesses, `check-*` scripts, `test:metrics`, Playwright/Chromium at 1280 px and 380 px in light and dark) or verified line by line in the source. **Plausible** means there is a clear code path that the sampled runs did not hit. Anything recorded as fixed in `CHANGELOG.md` ("AUDIT-12 implementation") or in AUDIT-1…12 is left out.

**Naming constraint (unchanged):** one given-name field only. No surnames, surname pools, toggles, generation or hidden metadata.

---

## 1. What matters most

1. **Careers die at the horn too often, and almost always to outsiders (K1–K6).** Across three independent harnesses (300, 160 and 150 runs), between 20.0% and 26.7% of Careers die in the bloodbath: about 1.4 of 6 per Games. 87–91% of those deaths are kills by non-Careers (419/481; 205/226). A volunteer dies at the horn exactly as often as a reaped Career (26.7% vs 26.8%). There are three causes. Every outsider in the scrum aims at Careers because of `personaThreat × 2` in `pickOpponentIndex`. The horn/edge split ignores Career status. And nothing ever discounts the fear a Career feels toward an outsider.
2. **Careers are frightened of outsiders (K3, K4).** `addFear` has no Career or volunteer term. By day 2, 74% of surviving Careers hold ≥30 fear of some outsider, and Careers retreat from non-Careers 2.2× as often as non-Careers retreat from Careers (847 vs 378 in 160 Games).
3. **Convergence closes zones with tributes still inside, and the border then reopens them (B1, B2).** A living tribute stands in a collapsed zone in 42% of runs. In 49/120 runs the first border step reopens zones the convergence had closed.
4. **Alliances churn (R1, R2).** The median alliance lasts 2 cycles, and 76% dissolve with two or more members still alive. Nothing records how an alliance ended.
5. **Staleness.** More than half of every run's lines repeat within the same run. 29 goodbye-room lines appear in 112 of 112 runs. Status deaths ("Died of untreated burns") carry no arena flavour.
6. **Side systems the player never sees (S1–S4).** Story chains, nemeses, reunions, arena mastery and patron's regret all run in the engine, and none of them reaches the UI.

## 2. Evidence

| Check | Result |
|---|---|
| Horn harness, 300 runs, 24 tributes (`BB-*`) | Careers 26.7% dead at the horn (volunteer 26.7%, reaped 26.8%), non-Careers 33.5%. Career horn deaths: 419 by non-Careers, 48 by Careers, 14 other. |
| Tribute/alliance harness, 160 runs (`TR-*`) | Career horn death 23.6%. Career fear of outsiders 57 pts before the gong. 74% of Careers hold ≥30 fear of an outsider on day 2. Retreats: 847 Career→outsider vs 378 outsider→Career. 7.5 alliances per Games, median life 2 cycles. |
| Invariant harness, 120 + 150 runs (`B13-*`) | No NaN, no stale leaders, no dead tribute gaining kills. 30/30 save/restore identical. Found: living tributes in collapsed zones in 50/120 runs, and zones reopened in 49/120. |
| Death-mix harness, 224 runs, 5,150 deaths | Tribute share by arena 51–74%. Signature share 1% in 9 arenas. `fall` 6–17% everywhere. Per-run unique-line ratio 0.43–0.49. |
| `check-achievements` (500 runs) | 56/449 never unlock. 11 labelled "possible" measure 0.2%. 23 unlock in ≥60% of runs. `a8-bought-nothing` unlocks in 100%. |
| `check-names` | Pass. 4,205 distinct folded names; the thinnest pools are D8 male 119 and D16 neutral 24. |
| `METRICS_RUNS=400 test:metrics` | Pass; all guards hold. Mean 10.3 days, Careers 32.5% of victors, largest district share 12.5%. Whole-field archetype spread 15.1× (noise-dominated at n=400). Turncoat and Gambler signatures fire in 11.0% and 9.2% of their runs. |
| Playwright, 1280/380 px, light/dark | No console errors, no horizontal overflow. 7 UI bugs, 10 QOL items (§3.3, §4). |

---

## 3. Bugs

**P1** broken core behaviour or visible breakage; **P2** incorrect mechanics or misleading output; **P3** latent or maintenance.

### 3.1 Career and volunteer behaviour (the user's priority)

**K1 — P1 — Confirmed — Outsiders deliberately target Careers in the scrum.** `pickOpponentIndex` (`src/engine/phases/bloodbath.ts:1073-1098`) adds `personaThreat(target) * 2`. The personas Careers pick most (Ruthless Warrior 0.35, Professional 0.30, Arrogant Brute 0.30; `src/data/personas.ts:46`) give +0.6–0.7 on a base weight of 1. The result is that every outsider in the knot swings at the pack. Only the Career side of the function carries a "hunt the weak" term. **Fix:** for a non-Career attacker facing a Career target, replace the persona term with an avoidance term: weight × (0.4 + 0.1 × attacker strength − 0.5, floored at 0.2), scaled up by grudge. Keep the persona pull for outsider-on-outsider targeting.

**K2 — P1 — Confirmed — Careers are split between horn and edge at random.** `announceGongDecisions` (`bloodbath.ts:465-491`) slices fighters into `deepIds` by `scrambleOrder`. A Career left out of the deep group fights alone at the edge and dies 37% of the time, against 26% at the horn. The pack gang-up branch (`:850`) needs ≥2 packed Careers still in the pool, takes at most 3, and fires at `packGangUpChance`. **Fix:** place pack Careers in `deepIds` first, so the pack arrives together. Raise `packGangUpChance` to about 0.8. Let the gang-up take the whole pack (≤4).

**K3 — P1 — Confirmed — Nothing discounts a Career's fear of an outsider.** `addFear` (`src/engine/fear.ts:26-49`) scales only by the source's intimidation, the archetype `fearScale` and the `fearGain` trait. Only the training intimidation beat exempts Careers (`training.ts:1943`). Every other source hits them in full: cluster tension `training.ts:471`, threats `:538/:550`, lunch clashes `:648-788`, altercations `:1014`, the interview callout `interviews.ts:329`, `lostExchange` 14 (`combat.ts:1102`), and `witnessedKill` 30 for everyone in the zone (`combat.ts:2226`), which at the horn means every Career. **Fix:** add `FEAR.careerOutsiderScale ≈ 0.35` and `FEAR.volunteerOutsiderScale ≈ 0.2`, applied when `t.isCareer` and the source or `otherId` is not a Career. Pass `source` at `combat.ts:1102` and `:2226` so the discount can see who it is. A Career who watches an outsider kill during the bloodbath gets *target priority* on that outsider, not fear.

**K4 — P1 — Confirmed — Careers retreat from outsiders 2.2× as often as the reverse.** `wantsToRetreat` (`combat.ts:927-955`) has one flat Career term of −0.1 (`:946`), and it adds `fearFraction × FEAR.retreatWeight` (`:951`) and notoriety (`:955`) at full weight. On top of that, the Career creed `disengage: 'unworthy'` (`archetypes.ts:491`, `combat.ts:~899-906`) is logged as a retreat and calls `noteFled` (`combat.ts:1328`), which feeds rivalry and notoriety. **Fix:** (a) against a non-Career, scale the fear and notoriety terms by 0.3 for a Career and 0.15 for a volunteer. (b) Change the Career term to −0.2, with a further −0.1 while ≥2 packmates share the zone. (c) Log the `unworthy` disengage as "turns to a better target", with no `noteFled`. (d) Block that disengage when the opponent is on the Career's vengeance list or has killed a packmate this Games (T8).

**K5 — P2 — Confirmed — `volunteered` has no mechanical effect after the reaping.** The flag is read by interviews, training floors and the excitement roll (`pregames.ts:224`, `training.ts:1850`, `interviews.ts:175-247`), but not by the bloodbath, combat, fear or retreat code. **Fix:** a volunteer Career gets the stronger discounts in K3/K4, plus a first-exchange edge of about +1 against an unarmed outsider at the horn (`BLOODBATH.volunteerFirstStrike`). A reaped Career gets roughly half of the Career discount and a small chance to break from the pack early, which also feeds the rare `career-defections` beat (6 in 160 runs).

**K6 — P2 — Confirmed — No guard holds the Career horn rate.** **Fix:** add to `test:audit12` (or a new `test:audit13`) a guard of volunteer-Career horn death ≤ 12% and all-Career ≤ 15%, with Career victor share still ≤ 55%. Be aware that K1–K5 together push Career victors up, and the AUDIT-11 Career-victor guard exists for a reason. The expected balancing lever is mid-game, not the horn: the pack's internal fracture (`careerEarlyCollapseChance`, the betrayal-intent score in R3), and outsiders hunting a pack that has lost members. The goal is Careers surviving the horn and then killing each other, not Careers winning more.

### 3.2 Engine

Method: an invariant harness over 120 seeded full Games (`B13-0..119`, every arena plus procedural, one run in three with 8 districts), checked after every phase step. A second pass ran 150 seeds. Checks covered: NaN/Infinity, health range, negative vitals, living tributes at 0 HP, dead tributes gaining kills, "Killed by X" where X was already dead, items on the dead, stale alliance leaders and dead ids in `allianceId`/`memberIds`, packs down to one member, zones that do not exist, living tributes inside collapsed zones, zones reopening, log lines whose first actor is dead, runs that never end, multiple tributes alive at the end, and save/restore determinism (a JSON round-trip at step 12 in 30 runs, then both copies played to the end and the final state compared).

These all came back clean: NaN 0, health out of range 0, negative vitals 0, unknown zones 0, stale leaders 0, dead `allianceId` 0, dead tribute gaining a kill 0, runs that never end 0. Save/restore determinism held in **30/30** runs. Every living tribute at 0 HP (383 samples) was in the intended downed state. All 3 endings with more than one survivor were intended dual-victor rules (`victorIds` set).

#### B1 (P1, Confirmed): convergence and `earlyCollapse` close zones with tributes still in them, and nobody is moved out
- Measured: **50/120 runs (42%)** have a living tribute standing in a zone listed in `collapsedZones`. That is 456 tribute-phase samples, and **430** of them happen before `escalationDay` is set. Example: seed B13-0 (clockwork), D4 night. `collapsedZones` goes from [] to 6 sectors in one step, Cilla stays in "Sector 1 (Jungle)" and gets no border-collapse line, and she is still there the next cycle.
- Cause: `maybeConverge`/`convergeNow` (`src/engine/arenaEventPacks.ts:373-400`), `tickConvergence` (`:485-497`) and the `earlyCollapse` event (`:319-325`) push onto `state.collapsedZones` but never evict anyone. The only relocation loop is inside `collapseBorders` (`src/engine/phases/dayNight.ts:1348-1414`), and that function returns early at `:1308` (`if (ctx.state.escalationDay === undefined) return false;`) before it reaches the loop. Compare `collapseZonePermanently` (`src/engine/arenaRules.ts:244-253`), which does call `evictZone`.
- Fix: send every write to `collapsedZones` through one helper that calls `evictZone`, or the same `nearestSafeZone` relocation. Or run the relocation loop in `collapseBorders` before the early return, over whatever `collapsedZones` currently holds. Add a guard to `check-audit12`: no living, active tribute in a collapsed zone at the end of a phase.

#### B2 (P1, Confirmed): starting the border reopens every zone the convergence closed
- Measured: **49/120 runs** have zones leave `collapsedZones` (341 zone reopenings), almost all on the first escalation day. Example: seed B13-0, D7 day. Eight convergence-closed sectors reopen once `escalationDay=6` kicks in. Seed B13-8, D7 night: seven reopen.
- Cause: `collapseBorders` rebuilds the list as `collapseOrder.slice(0, thisCount)` and then `withFallen` (`dayNight.ts:1310, 1345-1346`). Convergence and `earlyCollapse` zones are not "fallen", so the assignment drops them. The convergence announced the field being "driven to" the horn, and the border then gives the ground back.
- Fix: merge the current convergence and early closures into the rebuilt list, e.g. `collapsedList = [...new Set([...collapsedList, ...convergenceClosed(state), ...fallen])]`. Record convergence and early closures in `arenaRuleState` the way `fallen` is recorded, so the recompute can't lose them. The same closure-owner idea as E2 would work here.

#### B3 (P3, Confirmed): a bleed-out after the attacker has died is still worded and typed as a tribute kill
- Measured: 4 deaths in 150 runs. Example: B13-24 D5 night, "Voltina: Killed by Muslin — bled out where they fell", with Muslin already dead. `kills` is (correctly) not incremented, but `lastDamage.kind === 'tribute'` and `causeOfDeath` still names a corpse as the killer. That is the E5 intent only half-applied.
- Where: the bleed-out and left-for-dead paths in `src/engine/downed.ts` (the `name => \`Killed by ${name} — bled out…\`` formatters near :430-445).
- Fix: when the recorded source is dead at the moment of death, use "Bled out from a wound X gave them" or code `bleeding`, and keep the death out of tribute-kill tallies and the death-mix `tribute` share.

#### B4 (P3, Confirmed): `Alliance.memberIds` keeps dead members between reconciles
- Measured: 392 phase samples of a dead id still in `memberIds`. Separately, 7/150 runs have a record with fewer than 2 living members that lasts a phase (e.g. `career-pack-B13-56`, 1 living, D1 night).
- Readers that don't filter by status: `src/components/AllianceLedger.tsx:52-58` and `src/components/WhatIfPanel.tsx:34` (`memberIds.length >= 2` offers what-if branches for dead packs). `reconcileAlliances` (`src/engine/alliance.ts:732+`) is what prunes them, and it runs late.
- Fix: strip the id from `memberIds` inside `checkDeath` (keep history in the ledger entry `alliance.ts:727`), and dissolve a record with fewer than 2 living members right there. Or filter by living in the two UI readers.

#### B5 (P3, Confirmed): memorial and aftermath lines put a dead tribute first in `tributesInvolved`
- Measured over 120 runs: death 454 (anthem roll-calls, fine), survival 37 (for example "The half-built frame in The Rooftop Gardens has nobody left tending it", which repeats **every cycle**: B13-2 logged it D14 day, D14 night, D15, D16), alliance 14 (`truce-outlived`, `vengeance-outlived`), sponsor 3, romance 7 (`romance-reveal` at epilogue).
- The real bug is the repeat. The abandoned-work decay line (`src/engine/abandonedWork.ts`) fires every cycle for the same frame. Also, a dead tribute as the first actor puts these lines into that tribute's "their story" filter as if they were acting.
- Fix: log the abandoned-work line once per structure, with a flag on the work item. For memorial-style lines, put the living subject first, or add an `actors`/`subjects` split so feed filters can tell acting from being remembered.

#### B6 (P3, Plausible): items stay on dead bodies indefinitely
- 8,066 samples of a dead tribute still holding inventory a phase or more after death. Example: B13-0 Scilla keeps "Capitol Falchion, Heavy Kukri, Capitol Condenser" for the rest of the run. This may be intentional (a corpse you can loot), but inventory-value readers such as the `inventoryValue` checks in `arenaDepth.ts:981`, or sponsor and odds code that iterate `state.tributes` without a status filter, could count dead kit.
- Fix: move a corpse's kit to a zone cache (the B07 pattern in `alliance.ts`) after N cycles, or confirm every inventory reader filters `status === 'alive'`.

### 3.3 UI

**U1 — P2 — Confirmed — Zone-stripping leaves a double comma ",," in log prose.** `stripZoneClause` (`src/components/EventFeed.tsx:98-109`) removes the text in the middle of a parenthetical such as ", in {zone}," and leaves ",,". Measured: 95 mangled lines in 15 seeded runs, about 6 per run. The raw engine text had 0. Seen live: "Monocle tells Iron straight out,, that only one…" (source `engine/phases/alliances.ts:421`), "an Antivenom Ampoule for Chandelle,, from…", "Volmer,. The crate…". Fix: when the clause is bounded by commas, match `,\s+(in|at|…) Z,` → `,` and collapse `,\s*([,.;])` → `$1`. Add a unit test over templated samples.

**U2 — P2 — Confirmed — The finished Games end on a dead-end page.** After "Close the Games" the reader lands on `#/chronicle?day=N&phase=epilogue`. The page holds one line of text, a disabled "Next page", and no button that leads to the victor interview or debrief. The only way on is the "Debrief" item in the top nav (`ChronicleScreen.tsx:639-656`: when `canAdvance` is false, the primary slot turns into a disabled Next page). Fix: when `phase ∈ {epilogue, ended}` and the reader is on the last page, show a primary "See the debrief →" button in that slot, or route there automatically after Close.

**U3 — P3 — Confirmed — "Skip to the gong" does not reach the gong.** `skipToGong` (`store/gameStore.ts:1556-1567`) stops at `interviews`, so you land on "Stage 9 of 9" and still have to press "Sound the gong". Fix: rename it to "Skip to the interviews", or add a second press or option that also calls startGames.

**U4 — P3 — Confirmed — Two progress counters on the pre-Games pages disagree.** The footer shows "7 / 7" pages and "Stage 9 of 9 before the gong" side by side (`ChronicleScreen.tsx:621,628`). Fix: show only one of them before the gong, or label them "page 7/7 · stage 9/9".

**U5 — P3 — Confirmed — The "Filters •" dot shows with no filters active.** It appeared on a fresh chronicle page with default filters. Fix: show the dot only when `filtersActive()` is true, and add an aria-label saying how many filters are active.

**U6 — P3 — Confirmed — Confirming the cast takes you to the Chronicle, not the arena.** It lands on an empty chronicle page ("The cast is confirmed and the record is empty"), and at 380 px the next step, "Go to the square", sits below the fold. Fix: open straight into the first pre-stage, or put a sticky CTA on the empty state.

**U7 — P3 — Plausible — Grammar in item templates (engine, noted for the owners).** Seen in the log: "worth more than an Throwing Axes. The Throwing Axes is what…" and "raised. a Mace". Fix: give items an article and plural flag, and capitalise text that follows a full stop.

---

## 4. QOL, UI and UX improvements

**Q1 — The debrief is 8,810 px tall at 380 px** (measured). Every achievement card is expanded. Collapse to the top 5 plus a "Show all N" button, and add jump links (Summary · Achievements · Stats · Standings).
**Q2 — Chronicle search and "jump to death" on the page itself.** `searchText` exists in `chronicleStore.ts:31`, but there is no search field on the page. Runs average about 1,880 log lines, up to 2,480. Add a search box plus next/previous death buttons (the palette already has the logic).
**Q3 — Auto-advance/autoplay with speed control** in the chronicle footer. Right now each stage needs one click; a full run took 39 clicks. Add Play/Pause and a delay of 1–5 s per stage, and remember the choice in prefsStore.
**Q4 — Keyboard shortcuts for the chronicle** (←/→ exist): add `N` for the next stage, `/` for search and `?` for a help overlay, and show them in HowToPlay.
**Q5 — "Replay this seed" and "same settings, new seed"** as primary CTAs on the debrief. The seed chip only copies.
**Q6 — The epilogue page is thin** (one line). Merge it into the victor interview, or add a recap: kills, days and the final two.
**Q7 — The day strip has 37 tiny cells at 1280** with no labels or tooltips. Add a `title` and aria-label to each cell ("Day 6 night · 2 deaths"), and give them 24 px touch targets at 380.
**Q8 — Export:** add a "copy only this page" option next to the full-chronicle export (`ChronicleExport.tsx`).
**Q9 — Undo of the last advance.** Snapshot the simulator before `nextPhase` so the reader can rewind one stage. The replay scrubber already exists; wire it up for runs in progress.
**Q10 — Persist the setup choices** (last arena, last config preset) and prefill them on "New Game".

---

## 5. Tribute logic: robustness and complexity

Measured baseline (160 runs, default 24-tribute field):

| metric | value |
|---|---|
| Career bloodbath death rate (volunteers / reaped Careers / non-Careers) | **23.6% (208/883)** / 23.4% (18/77) / 35.1% (1013/2888) |
| Careers lost at the horn per Games | 1.41 of 6 |
| Career horn deaths caused by a non-Career / by another Career / other | 205 / 11 / 10 |
| Career horn death rate by gong decision: `horn` / `edge` | 26% (114/438) / **37% (107/290)** |
| Careers already allied at the gong | 96% (460/480, 80-run check) |
| Career fear toward non-Careers before the gong (sum per Career) | 57 pts (non-Careers toward Careers: 185) |
| Careers on day 2 holding ≥30 fear of at least one outsider | **74% (516/700)**, mean 148 fear pts toward outsiders |
| Retreat lines: Career fled from non-Career / non-Career fled from Career | **847 / 378** (5.3 vs 2.4 per Games) |
| Retreat lines: Career from Career / non-Career from non-Career | 926 / 1693 |
| Alliances formed per Games | 7.5 (1199); size 2: 39%, 3: 19%, 4: 12%, 5+: 30% |
| Alliance lifetime (cycles) | median **2**, p90 9 |
| How alliances end | 76% vanish with ≥2 members still alive (split/dissolve), 20% down to 1 member, 4% wiped out; 0.3% reach the end |
| Betrayal-type beats per Games | ~1.3 (exotic 150, preemptive 41, grudge 8, career-defection 6, turncoat-coup 5) |
| Faction walkouts / expulsions per Games | 2.3 / 1.3 |
| Tributes ever allied | 73% (Careers 98%) |
| District partners ever in the same alliance / one killed the other | 46% (890/1924) / 3.3% (63) |
| Romance reveal / romance-tragedy beats | 17 / 14 in 160 runs (about 0.1 per Games) |
| Vengeance sworn / paid / soloed / abandoned | 2845 / 68 / 159 / 51 |

The Career and volunteer items from this pass are in §3.1 (K1–K6).

**T5 (P2, Confirmed): the gong decision for fighters is decided by order, not by the tribute.** `announceGongDecisions` (bloodbath.ts:465-491) splits fighters into horn and edge by `scrambleOrder` slice only. `chooseHornPlan` (bloodbath.ts:440-455) is computed but does not decide horn vs edge.
*Fix:* feed `hornPlan` into the horn/edge split: `grab` goes deep, `scatter` works the edge. Add a `shield` option: guardian or protector archetypes, or a tribute with a pact partner, stays next to that partner.

**T6 (P2, Confirmed): runners' choice is a single chain of fixed-share rolls.** `ally` → `freeze` → `wait` → `flee` (bloodbath.ts:477-489). In 160 runs Careers chose `ally` 4 times and `wait` once. Motive (`t.motive`, types.ts ~1282: family/partner/prove/honour/escape) is never read here.
*Fix:* score the options from motive. `partner` and `family` push toward ally or shield; `prove` pushes toward the horn; `escape` pushes toward flee. `honour` refuses to strike a plate neighbour it made a pact with.

**T7 (P2, Plausible): fear toward a person decays by a flat 0.9 per cycle (fear.ts:103-115).** Nothing else ever resolves it. `reduceFear` exists, but beating the person, or seeing them wounded or crying, only partly offsets it.
*Fix:* add a "saw them bleed" reduction when a feared rival goes downed or drops below 40 HP within sight. Add a "survived them" reduction when a tribute wins an exchange against someone they fear. The bravery beat should come from courage getting past fear, not only from decay.

**T8 (P3, Confirmed): the `unworthy` disengage (combat.ts:~899-906) reads only `targetWorth` = health + training score.** It ignores grudge, vengeance, and whether the current opponent killed a packmate.
*Fix:* block the disengage when the opponent is on the Career's `vengeance` list, or when they have killed an ally this Games.

---

## 6. Relationships and alliances

**R1 (P2, Confirmed): alliances churn too fast.** The median alliance lasts 2 cycles, and 76% vanish with ≥2 members still alive. Recruitment (998) and merges (274) keep reshuffling people who have just split up, so groups rarely build a story.
*Fix:* add a cohesion floor. For the first 3 cycles after forming, voluntary dissolution needs a trigger (a breach, a faction, a shortage). When a group splits, record `splitFrom` on both halves so they can have a reunion or feud beat. Guard with alliance median lifetime ≥4.

**R2 (P2, Confirmed): state keeps no record of how an alliance ended.** `AllianceRecollection` (types.ts:1989-1999) stores size, members, and cycles but no `endReason`. That is why this audit had to infer endings, and why the recap, what-if, and museum can't tell the story.
*Fix:* add `endReason: 'attrition'|'splinter'|'betrayal'|'pact-expired'|'walkout'|'merged'|'victor'` plus `endedById?`, and write it everywhere `pruneDeadAlliances` or a dissolve path removes an alliance.

**R3 (P2, Confirmed): betrayal is rare, and most of it is the "exotic" kind.** About 1.3 per Games, and only 8 grudge and 41 preemptive betrayals in 160 runs. The pact's scheduled break is the most watchable version, but `pact-honoured` is logged far more often than an actual break.
*Fix:* when the endgame nears, run a betrayal-intent score each cycle (ambition × low trust × the ally's kit value × fewer alive). Show a one-cycle warning beat ("counts the knives") so viewers can see it coming.

**R4 (P2, Confirmed): district partners stay thin.** They end up in the same alliance 46% of the time and kill each other 3.3% of the time. `district-bonds` fired 135 times (0.84/Games), and nothing else is keyed to the partner.
*Fix:* add a partner arc: search for the partner after the horn (a movement bias toward their last sighting), a "last of the district" resolve boost once the partner dies, a partner-grief variant of `grief-day`, and a canonical "we can't both go home" standoff when they are the final two.

**R5 (P3, Confirmed): romance barely appears.** 17 reveals and 14 tragedies in 160 runs.
*Fix:* when two allied tributes of compatible age share a rescue or a watch rota, roll a slow-burn `rapport` ramp that ends in a declared romance, and give the sponsors a bonus for it. The `sincere` map (types.ts:3003) already supports a showmance-vs-real twist.

**R6 (P3, Confirmed): vengeance is sworn constantly and rarely paid.** 2845 sworn, 68 paid (2.4%). Sworn vengeance barely changes behaviour apart from the `hunt` gong choice.
*Fix:* cap active vengeance at 2 targets per tribute. Add a hunt objective that biases movement toward the target's remembered place. Add a "vengeance cooled" beat when the target has been out of sight for N cycles.

**R7 (P3, Plausible): no mentorship inside the arena.** Older and younger allies have no teach or protect link. Apprenticeship exists only across seasons.
*Fix:* when an ally ≥17 is paired with one ≤14, add a `ward` edge. The ward's skill training speeds up and the elder gets a guardian-stand chance. If the elder dies, the ward inherits a trait.

---

## 7. Trait, archetype, skill, stance and district balance

Measured with `METRICS_RUNS=400 npm run test:metrics` (exit 0, all guards hold) and `DIAGNOSE_RUNS=400 scripts/diagnose-archetypes.ts`. At n=400 one archetype row moves by ±3–5 pp between runs, so any single-run call is marked Plausible until it has been re-measured at 1,600 runs. **Interaction with §3.1:** the K fixes add surviving Careers, so the numbers below have to be re-measured once K1–K5 have landed. The career row (3.91% in diag) is expected to rise.

### 7.1 Captured tables and measurements

- Runs 400, victors 399, average 10.3 days, bloodbath share 31.7%, Careers 32.5%, largest district share D2 12.5%, 12/12 districts ≥ 4%.
- **District tiers**: modest 6.0 / storied 5.9 / forgotten 5.1 / thin 5.0 / strong 4.8%. D9 5.5, D10 6.0, D11 5.0%. District balance is solved at this sample size; no change proposed.
- **Stances**: Evasive 30.1 / Aggressive 23.5 / Defensive 11.7 / Scavenging 6.5 / Fortified 4.9 / Baiting 4.6 / Nursing 3.2 / Tending 3.0 / Hunting 2.8 / Parleying 2.0 / Patrolling 1.9 / Hiding 1.9 / Shadowing 1.9 / Desperate 1.8%.
- **Archetype win %, top**: guardian 11.58 (n95), archivist 7.96, forger 7.79, underdog 7.71, mercenary 7.66, wildcard 7.49.
- **Archetype win %, bottom**: scholar **0.53** (n190), martyr 1.68, diplomat 1.72, confessor 2.44, beast 2.80, warden 2.96, debtor 2.96. Whole-field spread 15.1× against a 2.3× goal. The spread is mostly the scholar row's noise.
- **Diagnose, worst**: hermit 0.00% (n84), quiet 1.67, forger 2.08, tracker 3.05, diplomat 3.07, medic 3.55, protector 3.79, career 3.91.
- **Horn-death share (diag)**: wildcard 44.4, tracker 44.1, mercenary 43.4, captor 42.7, engineer 42.3, debtor 41.8, quiet 41.5 … ghost 24.2, forecaster 24.3.
- **Days survived**: longest archivist 5.44, penitent 5.32, ghost 5.29 (diag) / forager 5.27; shortest beast 3.66–3.91, zealot 3.71, gambler 3.80.
- **Signature fire rate**: turncoat **11.0%**, gambler **9.2%**, forger 27.3, guardian 29.5, courier 30.6 … archivist 71.7.
- **Reaping traits**: Paranoid 10.16 (n128), Stone-Faced 8.82, Hard Bargain 8.74, Silver-Tongued 8.66 … Crowd-Pleaser 2.80, Shared-Burden 2.94, Unremarkable 3.01, Butcher 2.68. Spread 3.79× against a 2.5× goal.
- **Modifier outliers**: Dead-Eyed 2.8 sd, Quiet Room 2.7, Ruthless 2.6, Broken 2.6, Paranoid 2.5, Pacifist 2.4, Spent 2.4, Waterborn 2.2 (still hot after the ×0.7 cut).

### Dead or negligible hooks

- **A1 (Confirmed: no dead keys).** I checked every `TraitMod` key (`src/data/traits.ts:22-106`) for a `traitMod(…, key)` read outside traits.ts. All have at least one read. `burnResist` and `coldResist` look unread to a literal grep, but they are read through the `resist(key)` closure in `src/engine/exposure.ts:115-136`. Every trait with no mods and no literal reference is wired through a named helper: Evidence-Hungry → `memory.ts:116`, Exit-Minded → `actionBudget.ts:141`, Bargain-Shy → `obligations.ts:131`, Cornered Rat → `traitHooks.ts:137`, Scar-Reader → `traitHooks.ts:255`. Every exported `traitHooks.ts` function has a caller.
- **A2 (Confirmed, negligible). Knot-Tier** `{ trapSkill: 0.08 }` (`traits.ts:1231`) is the only numeric mod, and Trapline (0.12, `:1104`) and Trapper (0.28, `:464`) both dwarf it. Its identity is the food-trap branch (`fieldcraft.ts:534`). Proposal: 0.08 → 0.12 plus `forage: 0.04`, so the trait adds up to more than a smaller copy of Trapline.
- **A3 (Confirmed, negligible). Scar-Reader** `{ awareness: 0.2 }` (`traits.ts:1204`). Paranoid gives 1.5 and Light Sleeper 0.95, so 0.2 is below noise. The hook (`scarReaderSees`) only matters when a fight is picked. Proposal: `executeDrive +0.1` and `vengeanceEdge 0.5`. It knows who is hurt, so it finishes them.
- **A4 (Plausible). Unremarkable** has `targetDraw: -15` (`traits.ts:442`). Every other trait sits between −2.5 and +1.5, yet the trait wins only 3.01% (n133), last-six on the reaping table. Either `targetDraw` is swamped by other terms in the hunt score (the CHANGELOG's AUDIT-11 section says the same of storied `targetDraw`) or −15 saturates. Proposal: probe it at −3 against −15. If the rate does not move, `targetDraw` is a weak lever everywhere and the hermit/tracker changes that rely on it (`archetypes.ts:1331`, `:857`) need a different knob.

### Overlapping traits

- **A5 (Confirmed).** The **sleep cluster** has six traits on the same two keys: Insomniac `:170`, Sleepless `:507`, Sleepless Watch `:562`, Thin Sleeper `:1084`, Sleepless Week `:1099` and Night Owl `:1131`, all `awarenessNight`/`fatigue*`. Sleepless (`fatigueNight 2, awarenessNight 0.8, sanityDrain 0.15`) is Insomniac at a fifth of the size. Proposal: rework Sleepless so it wakes at the first noise, `{ awarenessNight: 0.8, defended: 0.3 }`, and drop the fatigue cost so it becomes a cheap alternative to Sleepless Watch.
- **A6 (Confirmed).** The **haggle cluster**: Bargain-Shy `:152` (0.25), Hard Bargain `:744` (0.4), Horse Trader `:852` (0.6 + persuasion 0.4) and Barterer `:542` (persuasion 1.5). Horse Trader is a strict superset of Hard Bargain without Hard Bargain's sponsor penalty. Proposal: Horse Trader `persuasion 0.4 → 0`, `haggle 0.6 → 0.5`.
- **A7 (Confirmed).** **Grappler** `:491` (unarmed 1.5, wrestle 0.4, retreat −0.03), **Grips Hard** `:1058` (1.5 / 0.2) and **Wrestler** `:320` are one trait at three sizes. Proposal: Grips Hard becomes the defensive version, `{ wrestle: 0.6, unarmedPower: 0.5 }`: hard to disarm, not a puncher.
- **A8 (Confirmed).** **Vengeful** `:349` (vengeanceEdge 3), **Grudge-Fed** `:873` (2) and **Long Memory** `:1223` (1) overlap. Long Memory should own grudge decay instead (`grudgeDecayScale`, `traitHooks.ts:195`) and drop `vengeanceEdge` to 0.

### Reaping-trait numbers (n 100–240; treat as leads)

| id | trait | status | change |
|---|---|---|---|
| A9 | Paranoid `traits.ts:236` | Plausible (10.16%, top; 2.5 sd) | awareness 1.5 → 1.1 |
| A10 | Stone-Faced `:713` | Plausible (8.82%) | intimidation 0.6 → 0.4 |
| A11 | Silver-Tongued `:390` | Plausible (8.66%) | sponsorTrust 2.5 → 1.8 |
| A12 | Butcher `:330` | Plausible (2.68%, last; it was cut from 2.5 and overshot) | meleePower 1.7 → 2.0 |
| A13 | Crowd-Pleaser `:505` | Plausible (2.80%) | concealment −0.05 → 0; add sponsorTrust 0.8 (appeal that never turns into parachutes) |
| A14 | Shared-Burden `:158` | Plausible (2.94%; pays fatigue for carrying with no upside) | add `defended: 0.3`, `rapport: 0.2` |
| A15 | Dead-Eyed `:532` / Quiet Room `:729` | Confirmed magnitude (2.8 / 2.7 sd) | Dead-Eyed intimidation 1.2 → 0.8; Quiet Room persuasion 1.5 → 1.1, combatPower −1 → −0.7 |
| A16 | Waterborn | Confirmed still hot (2.2 sd after ×0.7) | a further ×0.85 |

### Archetypes

- **A17 (Confirmed, code). Gambler's signature fires 9.2%** and 84.6% die without it. `gamblerWager` needs `odds < gamblerOddsMax 0.4` (`balance.ts:10881`) on a worth ratio of `health/10 + trainingScore + armed` (`archetypeHooks.ts:1245`). Between two healthy tributes that ratio rarely falls below 0.4. Proposal: `gamblerOddsMax 0.4 → 0.47` and `gamblerMinDay 2 → 1`.
- **A18 (Confirmed, code). Turncoat's signature fires 11.0%.** `turncoatCoup` needs day ≥ 3, an alliance of ≥ 3, and not being the leader (`traitHooks.ts:417-421`). 38% of turncoats die at the horn and only 7.4% reach day 8 (diag). Proposal: `turncoatMinMembers 3 → 2` (a coup over one partner is still a coup) and allianceAffinity 0.4 → 0.55 (`archetypes.ts:1450`) so turncoats end up in groups.
- **A19 (Plausible). Scholar 0.53%** (n190) against 3.66% at n1600 in AUDIT-12, and it is not among diag's worst eight (so above 3.9% there). Most likely noise. However, 81.3% of scholars who never fired their signature died at the horn. Proposal: `hornFight: -0.15` (the same knob hermit and forger use, `archetypes.ts:1338`, `:1507`), then re-measure at 1,600 runs.
- **A20 (Confirmed, both runs low). Diplomat** 1.72% / 3.07%, horn share 31.6%. `targetPreference: 'rival'` plus stance Defensive 0.6 gives a diplomat no way to finish a fight (0.34 kills, lowest). Proposal: statBias endurance 1 → 2; `targetDraw −0.5 → −1.0` (`archetypes.ts:616`); `stanceBias.Parleying 0.4` so the Parleying stance is the diplomat's home.
- **A21 (Confirmed, both runs low). Hermit** 3.90% / 0.00%. Diag shows hermits share a zone with **12.9 others on average and are alone only 5.3% of cycles**, so "camps as deep as the map allows" does not happen. Proposal: an objective `isolate` (or `wait` scoring the zone with the fewest known tributes) and `stanceBias.Hiding 0.6`. This is a logic gap, not a number.
- **A22 (Plausible). Martyr 1.68%** is structural: Nursing 1.2 and protect 0.8 mean it dies for others by design. Accept a low rate, but the `test:metrics` spread goal should exclude declared sacrificial archetypes (martyr, healer-pacifist), or the 2.3× goal can never be met.
- **A23 (Plausible). Guardian 11.58%** (n95) top, with a 29.5% signature rate. It combines strength 2, endurance 1 and willpower 1 (4 points; most archetypes carry 2–3) with alliance 0.35. Proposal: strength 2 → 1. Re-check at 1,600 runs before shipping.
- **A24 (Confirmed, both runs). Tracker** 4.42% / 3.05% with a 44.1% horn share. `targetDraw 1.5` (`archetypes.ts:876`) makes it the field's second most-wanted target on only 2 stat points. Proposal: targetDraw 1.5 → 0.75; `hornFight −0.1`.
- **A25 (Plausible). Beast** 2.80%, shortest-lived (3.66–3.91 d), 40.7% horn deaths: aggression 0.35 with intelligence −2. Proposal: intelligence −2 → −1.
- **A26 (Plausible). Horn-heavy trio**: wildcard 44.4%, mercenary 43.4% and captor 42.7% of deaths come at the horn, yet wildcard and mercenary still win about 7.5%. That is working as intended (high variance), so no change.

### Stances (A)

- **A27 (Confirmed).** Five stances sit under 2%: Desperate 1.8, Shadowing 1.9, Hiding 1.9, Patrolling 1.9 and Parleying 2.0. All clear the 1% guard, but Evasive (30.1%) still holds the share the new Hiding stance was meant to take. Proposal: A21's hermit Hiding bias and A20's diplomat Parleying bias, rather than any global change.

---

---

## 8. Arenas: robustness and complexity

Measured (224 runs, 5,150 deaths):

- Tribute share of deaths per arena: 51% (seapeaks) to 74% (sporefields). Procedural 70%, gallery 73%, glasshouse 72% and saltworks 72% sit above the AUDIT-12 50–72% band.
- `signature` share of deaths (A): 1% in tidewrack, thresher, kiln, malthouse, glasshouse, undercroft, islands, ashwaste and procedural. It reaches 8–11% only in carnival, menagerie, seapeaks, canopy, vault, culdesac and labyrinth. The ≥8% guard in `test:arena-deathmix` probably counts a wider set than `lastDamage.signature`. Otherwise it is being passed on a different metric (Plausible).
- `fall` is 6–17% of deaths in every arena, flat terrain included (saltflats 13/92, labyrinth 16, quarry 16, storywood 14). The biggest single contributor is the rescue line.
- The non-tribute deaths are dominated by generic status wording with no arena in it. Per 112 runs: "Died of untreated burns" 83, "Succumbed to poison" 45, "Succumbed to an infected wound" 45, "Froze to death" 42, "Bled out from untreated wounds" 41.
- Authored arena-event lethal entries by code (all groups): `hazard` 134, burns 25, poison 21, mutt 21, hypothermia 20, asphyxiation 19, drowning 14, fall 12, gamemaker 10, collapse 9. The remaining codes have 1–7 each, and starvation, sepsis and border have 1 each.
- Unique-line ratio per run is 0.43–0.49 across all arenas: over half of every run's lines repeat within that run. 293 normalised lines appear in at least 50% of runs, and 29 goodbye-room lines appear in 112/112 runs.

**W1 (P2, Confirmed): rescue-line fall cause leaks the internal zone label and one fixed noun.** `src/engine/rescueLine.ts:156` produces "Fell in The Cornucopia (The Clearing) when the knotted strapping went", along with "(Observation Deck)", "(Dooryard)", "(Crush Pad)" and "(City Square)". It is the most frequent non-status arena death string (≥25 of 112 runs). "improvised" always renders "the knotted strapping", and the parenthesised sub-zone is debug-style text. Fix: use the zone's display name only. Add a pool of 4–6 improvised items (belt, vine, tarp strip, sleeping-bag cord), picked by arena material. Down-weight rescue attempts on flat terrain (saltflats, labyrinth, storywood).

**W2 (P2, Confirmed): `fall` is over-represented on flat or indoor arenas.** Falls are 13–17% of deaths in saltflats, labyrinth, storywood and gallery (6/92). Fix: scale the fall weight by a per-arena verticality value (`verticality.ts` already exists). Where verticality is 0, re-code these deaths to trip, crush or collapse causes.

**W3 (P2, Confirmed): status deaths are arena-blind.** `src/engine/survival.ts:421` ("Died of untreated burns") and `:439` ("Froze to death") are shared by all arenas, as is `climate.ts:28`. Fix: add `arena.causeSkins[code]`, 3 variants each. Examples: kiln burns becomes "The kiln-burns went black and took them"; glacier becomes "Froze in a crevasse lee"; magmatube becomes "Cooked by the burns the tube left".

**W4 (P2, Confirmed): signature share is at 1% in 9 arenas.** Affected: tidewrack, thresher, kiln, malthouse, glasshouse, undercroft, islands, ashwaste and procedural. Fix: have the per-arena guard read `lastDamage.signature`, and set a floor of 5%. Tag the arena's existing hazard events (for example the malthouse burns at 14/92, which are its identity) as `signature: true` when they come from the arena mechanic.

**W5 (P2, Confirmed): the `hazard` code is a catch-all.** 134 authored lethal entries use `code: 'hazard'`, so the death-mix tile and the cause predictions cannot tell them apart. Fix: add codes `crush`, `impact`, `electrocution`, `sound`, `animal` and `exposure-pressure`, and re-code the 134 entries. `check-cause-codes` would then keep them from drifting.

**W6 (P3, Confirmed): procedural arenas are the thinnest.** Procedural has 22 unique cause shapes against 24–41 for hand-made arenas, a 70% tribute share and a 1% signature share. Fix: give each biome in `proceduralBiomeEvents.ts` one guaranteed signature death and one state-changing mechanic, taken from a biome→mechanic table.

**W7 (P3, Confirmed): arenas with the fewest unique cause shapes.** saltflats 24, sporefields 24, vigil 24, malthouse 24, canopyweb 26, silkwood 26, nooneplace 26, redcathedral 26, magmatube 26 and tidewrack 26. The next content pass should start with these.

**W8 (P3, Confirmed): sporefields is almost entirely tribute kills.** Tribute share is 74% and there are no mutt, burn or weather deaths. Fix: spore-bloom seasons (below) and a mycelium mutt.

**W9 (P2, Confirmed): the goodbye room and training repeat in every run.** 29 goodbye-room lines appeared in 112/112 runs: 24 tributes draw from a pool of about 30, so nearly the whole pool fires every time. Fix: cap it at 6–8 goodbye beats per run (feature the reaped favourites and let the rest go in one summary line), and triple the pool with district-conditioned variants.

**W10 (P3, Plausible): no night variants for arena mechanics.** Sampled lethal events rarely declare `requires.time`. Fix: add a night version for each signature mechanic, with a lower dodge chance and a different line.

System improvements:
- **W11 Dynamic terrain:** a zone state machine per zone (intact → damaged → ruined, or flooded ↔ drained, burning → ash → regrowth) that changes the zone's forage, hide and fall weights and its event pool. Signature events move the state forward.
- **W12 Weather chains:** use `weatherFront.ts` to build 3-step chains (humid → storm → flood; cold snap → freeze → thaw crack; heat → drought → wildfire). The next event's weight depends on the previous step, and a step can be forecast by a sponsor gift.
- **W13 Day/night schedule:** each arena gets a night rule (glacier lethal cold, carnival rides waking, acousticforest mimic calls louder). Stances respond to it: Hiding gets a bonus at night.
- **W14 Zone states the audience can see:** show zone state on the arena map (hatched ruined, blue flooded), and let Gamemakers target a zone state ("flood the drained quarry").
- **W15 Arena escalation arc:** days 1–3 stay quiet, days 4–7 bring the signature mechanic, and day 8+ brings a finale mutation such as the glacier calving or the kiln firing. This stops the pacing from being the same every day.
- **W16 Arena memory:** a feature where a death happened (corpse, cairn) changes later events there, and carries into the next Games in a season.

---

## 9. More ways to die

Existing causes, so nothing here duplicates them: Codes: tribute, bleeding, infection, sepsis, poison, shock, dehydration, starvation, exhaustion, hypothermia, heatstroke, burns, asphyxiation, exposure, status, nightlock, self-inflicted, drowning, fall, collapse, border, trap, machinery, hazard, mutt, gamemaker. Existing patterns: rope and anchor falls, border crush, smoke in burning rooms, ashfall choking, dust-front flaying, mimic mutt lure, stepping off the plate early, deadfall, own snare, abandoned pit, pressure pod, ride, calving, shifting wall, sump, the Group 7 set, and the 26 universal and 27 arena deaths already added.

(`D` numbers here are death proposals, not districts.)

### 9.1 New universal deaths (D1–D32)
Each needs a `code` and a `requires` condition.
D1 lightning strike on high ground during a storm (new code `electrocution`). D2 flash flood in a dry gully after rain upstream (drowning). D3 hit by a falling dead tree in wind (crush). D4 thin-ice or bog break while carrying a heavy load (drowning). D5 anaphylaxis from a wasp nest after foraging (poison). D6 a spear-fishing wound that festers (infection). D7 tetanus from a rusted Cornucopia blade, days later (sepsis). D8 a snakebite while sleeping on the ground (poison). D9 own campfire spreads to their bedroll while asleep (burns). D10 carbon monoxide in a sealed shelter with a fire (asphyxiation). D11 heart failure after 3 or more exhaustion days (exhaustion). D12 stampeding herd animals, not mutts (new code `animal`). D13 a bear or boar protecting its young (animal). D14 a fall while fleeing in the dark (fall, night only). D15 a crossbow or trap left by a dead tribute (trap, cross-run authorship). D16 a mislabelled sponsor gift, a pill overdose (poison, needs a medicine item). D17 hypothermia after swimming to escape (hypothermia). D18 a gear-fire explosion from mixed sponsor fuel (burns). D19 a gangrenous foot from wet boots (sepsis). D20 choking on food while starving (asphyxiation). D21 a cornice or overhang collapse onto a hiding place (collapse, Hiding stance). D22 a panic crush at a feast (crush). D23 dehydration after drinking seawater or salt water (dehydration). D24 drowning in their sleep in a rising puddle while downed (drowning). D25 a ricochet from their own thrown weapon (tribute-free, `impact`). D26 infection from a bite given by an ally in a fight (infection). D27 heatstroke while wearing armour (heatstroke). D28 frostbite amputation, then shock (shock). D29 a fall from a tree stand while asleep (fall). D30 poisoned water planted by a Gamemaker (gamemaker). D31 despair, stopping eating after an ally died (starvation, sanity band). D32 a hornet-mutt swarm drawn by blood on clothes (mutt).

### 9.2 New arena-specific deaths (D33–D76)
D33 clockwork: a sector's tick shears a ladder. D34 clockwork: caught in the hands' sweep. D35 frozen: a snow bridge collapses into a crevasse. D36 frozen: sleeping in the snow at whiteout. D37 concrete: a rebar spike in rubble. D38 concrete: a stairwell gives way. D39 toxic: acid-mist lung burn. D40 toxic: skin absorption from the pools. D41 solar: sun-glare blindness walk-off. D42 solar: mirror-array focus burn. D43 ashfall: pyroclastic flow. D44 ashfall: lahar mudflow. D45 tempest: a waterspout lifts them. D46 tempest: struck by flying debris. D47 saltflats: salt crust collapse into brine. D48 saltflats: mirage walk into the border. D49 sporefields: spore lung (asphyxiation). D50 sporefields: mycelial rot of a wound. D51 canopy: a strangler vine at night. D52 vault: an air-lock cycle with no air. D53 vault: a laser grid. D54 warren: a tunnel cave-in on sleepers. D55 islands: swept off a sandbar at high tide. D56 eclipse: a night-mutt during totality. D57 reef: a coral cut followed by sepsis. D58 reef: a stonefish step. D59 abattoir: hook rail. D60 abattoir: cold-store lock-in. D61 carnival: mirror maze exhaustion. D62 carnival: dunk tank. D63 quarry: a blast charge set off by the Gamemakers. D64 glacier: a moulin plunge. D65 floe: a floe split between two feet. D66 alpine: an avalanche on a traverse. D67 seapeaks: a rogue wave on the ledges. D68 canopyweb: a web anchor snapping. D69 acousticforest: resonance-shattered glass shards. D70 burnscar: a smouldering root flare-up. D71 culdesac: a garage door crush. D72 labyrinth: a hedge closing. D73 kelvin: a liquid-nitrogen vent. D74 silkwood: cocooned. D75 magmatube: a lava skylight fall. D76 menagerie: a released enclosure. Further arena deaths for the thinnest arenas: tidewrack (kelp snare), thresher (reel pull), kiln (door seal), malthouse (grain silo engulfment), glasshouse (a shattered pane falling), undercroft (ossuary shelf collapse), vigil (candle-wax suffocation) and procedural biomes (one per biome, see W6).


---

## 10. More events

### 10.1 New universal events (V1–V32)
V1 a supply drone crashes: loot, then a fight. V2 fog that swaps where tributes believe they are. V3 an animal migration crosses a zone. V4 a dead tribute's cache found with a note. V5 a Gamemaker "silence hour" with all noise tripled. V6 a drought that dries one water source for 2 days. V7 a fruit glut that brings every tribute to one grove. V8 a meteor shower (night) that gives hope and exposes positions. V9 a sponsor parachute lands in a tree or the water. V10 a Capitol broadcast of home footage that shifts sanity. V11 a fever outbreak passed between allies. V12 a false feast announcement. V13 a bridge or crossing washed out. V14 ally sleepwalking. V15 a trap found and disarmed, then reused. V16 a tribute's token lost, affecting sanity. V17 a snake nest in the camp. V18 a hidden spring discovered. V19 a wildfire started by a tribute's fire. V20 a mockingjay-like bird repeating a scream. V21 an injured animal that is either mercy or food. V22 a Gamemaker bounty on the leader. V23 a firefly night that makes camps visible. V24 a hailstorm that damages gear. V25 an earthquake that opens a cave. V26 a shared shelter in the rain between rivals. V27 a sponsor message scratched into a gift. V28 a weapon breaking mid-hunt. V29 a mutt carcass that others can loot. V30 insomnia across the field. V31 a map found in the Cornucopia. V32 a truce broken by a false alarm.

### 10.2 New arena-specific events (V33–V76)
V33 clockwork: the hands stop for a whole hour. V34 clockwork: a sector reverses. V35 frozen: the aurora gives warmth. V36 frozen: a seal hole for fishing. V37 concrete: a sniper nest found. V38 concrete: a working elevator. V39 toxic: a clean-air bubble zone. V40 solar: an eclipse break. V41 ashfall: the ash buries a cache. V42 tempest: the eye passes over. V43 saltflats: a brine shrimp pool. V44 sporefields: a glowing spore bloom. V45 sporefields: an edible cap season. V46 canopy: a fruit-bat swarm. V47 vault: a sealed room opens. V48 warren: tunnels flood. V49 islands: a land bridge at low tide. V50 eclipse: permanent dusk. V51 reef: a coral spawn night. V52 abattoir: the power fails. V53 carnival: the parade. V54 carnival: prize booth loot. V55 ashwaste: a rain of glass. V56 quarry: a water-filled pit. V57 glacier: an ice cave refuge. V58 floe: two floes merge. V59 alpine: a mountain hut. V60 terraces: a rice-paddy flood. V61 seapeaks: seabird eggs. V62 canopyweb: a spider egg hatch. V63 acousticforest: a song that calms mutts. V64 burnscar: green regrowth. V65 craterfield: a meteor fragment weapon. V66 culdesac: a house left intact. V67 labyrinth: the walls rotate. V68 ashgrove: a phoenix-tree bloom. V69 kelvin: a thaw day. V70 silkwood: silk that can be woven into rope. V71 nooneplace: a remembered landmark. V72 redcathedral: bells. V73 menagerie: animals loose in the fields. V74 storywood: a fairy-tale path offer. V75 cabin: the woodpile runs low. V76 magmatube: the lava drains. Minimum of 3 more each for tidewrack, thresher, kiln, malthouse, glasshouse, undercroft and vigil (lowest signature share).

---

## 11. Side features

- **S1 (P2, Confirmed).** Story chains run in the engine (src/engine/season/storyChains.ts:85 `chainFor`, :101 `tickStoryChain`, called from season/tick.ts:37) and are saved to the ledger (fold.ts:148), but no component or screen calls `chainFor` or reads `storyChains`. The player cannot see which step of an arena's chain they are on. **Fix:** add a "Chapter n/N" chip to the arena briefing and SetupSeasonPanel, plus a museum entry when a chain finishes.
- **S2 (P2, Confirmed).** The AUDIT-12 ledger adds nemeses and rivalries, which are applied at the reaping (pregames.ts:161 `applyLedgerAtReaping`). A grep for `nemesis` finds 0 hits in components/screens. Reunions (reunion.ts) also have 0 UI hits. These are carry-over stories the player never gets told about. **Fix:** add a "Returning grudges" strip to the Reaping screen and a TributeModal badge ("nemesis of X, Games n").
- **S3 (P3, Confirmed).** Arena mastery is written in fold.ts:123 and read only by `museumOf` (offSeason.ts:20). No achievement or setup hint uses it. **Fix:** add a mastery tier per arena on the Setup arena picker (bronze/silver/gold after 1/3/5 Games), and gate off-season skins behind it.
- **S4 (P3, Confirmed).** Patron's regret works only as a hidden weight multiplier (sponsorBlocs.ts:100, `blocRegret`) and no UI mentions it. **Fix:** add one line to the sponsor panel ("The Harbour bloc is still sore after D4's death: gifts −20%") so the player can plan around it.
- **S5 (P3, Plausible).** Daily pairs are named in the CHANGELOG, but no identifier `dailyPair` exists. The daily logic is spread across SetupScreen and panemStorage. There is no daily streak or daily-results history. **Fix:** keep `dailyHistory` in panemStorage (date, seed, victor, the player's pick right or wrong), add a streak counter, and add a "same daily seed" share code.
- **S6 (P2, Confirmed).** `a8-bought-nothing` (achievements.ts:5910) unlocks in 100% of harness runs because it only tests that `playerGiftCycle` is empty. A player who ignores the sponsor system therefore gets it for free. **Fix:** also require that the player's bankroll reached at least the price of the cheapest gift and that their pick won.
- **S7 (P3, Plausible).** Betting and side markets resolve per Games only. No bankroll carries across a 5-Games season. **Fix:** add a season bankroll with a buy-in and an end-of-season leaderboard in SeasonPanels.

---

## 12. Replayability

- **P1.** Seeded "scenario cards": authored starting states (a Career pack of 6, a lone D12 volunteer, allies from rival districts) that players pick like mutators, each with its own achievement.
- **P2.** A counterfactual challenge. Show a finished run's victor and ask the player to pick one intervention (sponsor gift, Gamemaker event) that changes the winner. Verify it with the existing what-if engine.
- **P3.** A district legacy meta-progression. Each district's win history across seasons shifts its tier (storied, strong, modest, thin, forgotten) up or down, so the sponsor landscape drifts over time.
- **P4.** "Commentator" personas. Two or three recap voices re-skin `beatVariants` so the same run reads differently.
- **P5.** Weekly rules: a fixed mutator pair, arena and seed for all players, with a local best-prediction score.
- **P6.** Draft mode. The player drafts 4 tributes before the reaping and scores points on their placements, which adds a fantasy layer on top of the prediction slip.
- **P7.** Victor-return Quell: a victor pool chosen from the player's own Hall of Fame, with scars and traits carried over (`veterans.ts` exists but is used only for Grudge-Match).
- **P8.** Arena "incidents" that persist. An arena that had a wipeout or a Gamemaker override gets a permanent scar/landmark zone the next time it is picked.

---

## 13. Shallow or incomplete features

- **H1 (Confirmed).** 56 of 449 achievements never unlocked in 500 runs, and 11 are mislabelled "possible" at a measured 0.2%: patient-zero, no-beast-touched-them, mercy-returned, the-long-walk, performed-to-the-end, no-victor, sold-the-arena, a7-whole-vocabulary, a8-put-their-hand-up, a12-last-rites, a12-airlock. **Fix:** relabel these as "legendary". For the zero-rate ones that are simulation-reachable (below), either lower the thresholds or tag them `requiresPlayer` so coverage stops counting them.
- **H2 (Confirmed).** 23 achievements unlock in ≥60% of runs: a8-bought-nothing 100%, the-recap 84.4%, made-them-blink 80.8%, d-return-address 80.0% (it fires on any `parachute-stolen`, achievements.ts:3306), apothecary 77.8%, blood-feud 76.2%. **Fix:** tighten each one, for example d-return-address could require that the thief was killed by the intended recipient.
- **H3 (Confirmed; the unreachable claims are Plausible).** Never-unlocking entries whose condition looks unreachable or nearly so: a7-scored-twelve (`trainingScore>=12`, achievements.ts:4771), a8-twenty-days (`day>=20`, :6072, against a mean run of about 11.9 days), a8-twelve-years-old (`age<=12`, :5955, depending on the age floor), bloodbath-massacre. **Fix:** check each against the generator's ranges, then lower it (score 11+, day 17+) or show it as "legendary" with a near-miss hint.
- **H4 (Confirmed).** The a12 player-driven ones (a12-called-it, a12-long-shot) are 0% because the harness never makes predictions. **Fix:** add a scripted-player mode to check-achievements (random slip and gifts) so player achievements get a measured rate.
- **H5 (Plausible).** The victor tour (offSeason.ts:31) and the museum each have one UI consumer (SeasonPanels). Neither is reachable from the EndScreen of the Games that produced them. **Fix:** add links from EndScreen ("Add to museum", "See the tour").

---

## 14. Achievements

The ids were checked against `src/data/achievements.ts`, and none already exist. K1–K5 change how often `a13-volunteer-first-blood` and `a13-career-wiped-bloodbath` fire, so measure both again after those land.

| id | name | condition | expected rarity |
|---|---|---|---|
| a13-volunteer-first-blood | First Off the Plinth | A volunteer Career scores the first kill of the bloodbath | common (~30%) |
| a13-career-wiped-bloodbath | Pack Broken Early | Every Career dies on day 1 | rare (<2%) |
| a13-outer-district-sweep | Outer Ring | The final four are all from D5–D16 | uncommon (~8%) |
| a13-sponsor-war-won | Outbid | The player wins a sponsor bidding war and that tribute wins | uncommon |
| a13-mentor-lineage | Lineage | The victor's mentor is a former victor from the player's own Hall of Fame | rare |
| a13-three-season-dynasty | Three Crowns | One district wins 3 Games inside one 5-Games season | rare |
| a13-nemesis-avenged | Settled Accounts | A tribute kills their ledger nemesis | uncommon |
| a13-rival-final-two | Old Grudge Final | The final two are carried-over rivals | rare |
| a13-museum-wing | Curated | 10 museum pieces from one arena | rare (meta) |
| a13-arena-mastered | Know the Ground | Arena mastery gold (5 Games in one arena) | meta |
| a13-story-chain-finale | Final Chapter | Complete an arena story chain | uncommon (meta) |
| a13-gauntlet-clean | Clean Gauntlet | Win a gauntlet where the player's pick survives every leg | rare |
| a13-daily-streak-7 | A Week of Dailies | Seven dailies in a row | meta |
| a13-cruelty-zero | Gentle Hand | Finish with the cruelty meter at 0 and the Gamemakers still steering | uncommon |
| a13-cruelty-max | Bread and Circuses | Max out the cruelty meter | uncommon |
| a13-bankroll-double | Doubled Up | Finish a Games with twice the starting bankroll | uncommon |
| a13-upset-called | Saw It Coming | The victor was priced 20:1 or longer when the player picked them | rare |
| a13-over-under-exact | On the Line | The bloodbath death count equals the over/under line | uncommon (~10%) |
| a13-side-market-sweep | Clean Sheet | Every side market won in one Games | rare |
| a13-apprentice-wins | The Student | The victor is a mentor's chosen apprentice | uncommon |
| a13-reunion-final | Home Again | A reunion pair makes the final three | rare |
| a13-splinter-victor | Broke Away | The victor left an alliance in a splinter | uncommon |
| a13-watch-rota-saved | Good Watch | A watch catches a night ambush and nobody dies | uncommon |
| a13-theft-on-watch | Asleep at the Post | Supplies stolen during a failed watch, and the thief wins | rare |
| a13-starved-out | Empty Ground | Forage depletion causes 2 or more starvation deaths | rare (~1%) |
| a13-risky-water | Drank Anyway | The victor survived drinking from the risky water source | uncommon |
| a13-signature-trio | House Specialty | 3 or more deaths from the arena's own signature causes | uncommon |
| a13-border-cap | The Border Is Closed | The border kill cap is reached and the arena hazard takes over | uncommon |
| a13-hazard-heeded | Read the Sky | Every tribute in a telegraphed hazard's zone moved out before it struck | uncommon |
| a13-hollow-victory | Hollow Crown | The victor ends with the hollow-victory sanity cost at its worst tier | uncommon |
| a13-truce-chain | Chain of Truces | Three loners bound in one truce chain | rare |
| a13-no-weapon-final | Bare Hands at the End | The last kill of the Games is unarmed | uncommon |
| a13-same-district-final | Home Final | Both tributes of one district make the final two | rare (~2%) |
| a13-district-first-win | Never Before | The first win ever for a district in the player's Hall of Fame | meta |

Check the semantic overlap with meta-dynasty ("The Dynasty") and long-truce before adding a13-three-season-dynasty and a13-truce-chain. Each new achievement needs a nearMiss, because `check-achievements` requires one for numeric thresholds.

---

## 15. Names (single given names only)

- **M1 (Confirmed).** Pool sizes: 16 districts with male 119–139, female 122–132 and neutral 24–30. That is 4,205 distinct names folded to lower case (the test reports 4,493 counting overlaps). D8 male (119) and D1/D5 male (121) are the thinnest. D16 neutral (24) and D13–D15 neutral (25) are the thinnest neutral pools. The initial-letter spread is 4.2:1 (S 386, Z 92), so new names should favour rarer initials.
- **M2 (Confirmed, P3).** Themed pools are already dense. 102 of my first 240 themed candidates, and 51 of my second 243, were already present (for example Travertine, Gunwale, Tulle, Quince). The remaining gaps are in the less obvious vocabulary below.
- **M3 (Confirmed).** 159 new single given names: no spaces, all checked case-insensitively against DISTRICT_NAMES and NEUTRAL_NAMES by script, with 0 collisions and 0 internal duplicates. Obvious surname-like words were removed. Grouped by district theme:

- D1: Brillante, Damaskin, Hyacinthe, Nacarat, Pavonine, Baguette, Tiffanie, Rondelle, Aigrette, Carcanet, Sautoir, Guilloche, Cloisonna, Intaglia
- D2: Basalto, Dolomir, Ashler, Grauwack, Quarrie, Stelae, Mastaba, Obelis, Pilaster, Architra
- D3: Bitwise, Capacita, Gigo, Pixela, Siliqua, Voxel, Solenoid, Heatsink, Firmwyn, Vacuo, Relaya
- D4: Dory, Eelgrass, Mullet, Pollock, Marlinspike, Sculpin, Dogfish, Herringa, Wrackel, Lugworm
- D5: Coulomb, Henri, Kilowa, Ohmira, Stator, Turbina, Megawyn, Busbar, Neutra
- D6: Ferro, Railey, Flatbed, Signalla, Switchman, Tramway, Monorel, Axlerod, Chassie, Cargoe, Hauler, Wagonet, Tachy
- D7: Mallet, Kerfa, Froe, Adzel, Sequoya, Sprucey, Cedrica
- D8: Felting, Hessian, Warpling, Weftie, Spindlee, Serger, Tweedy, Boucle, Mercera, Twillow
- D9: Rennet, Graina, Stooker, Tedder, Mealie, Awnlee, Glumme, Ricka
- D10: Steerling, Bullwyn, Calvie, Dorper, Angusa, Brahma
- D11: Harvest, Loamie, Cortland, Sheafa
- D12: Anthra, Bitumen, Colliery, Firedamp, Lampman, Shale, Slag, Whim, Cinderly, Coaly, Picket, Sumpter
- D13: Graphis, Lyddite, Ordnan, Plumbago, Shrapnel, Tamper, Trinity, Uranie, Fulmin, Detona, Fuzee, Caliber, Mortimer
- D14: Chillon, Evapora, Halite, Saltern, Vapor, Glacier, Freon, Rimeby, Briney, Cryo, Frostine
- D15: Annealer, Crystalle, Frit, Glassin, Lehr, Opalux, Blowpipe, Fresnel, Lenticula, Ambera, Gobletta
- D16: Drillbit, Fathomar, Gusher, Manifold, Rigger, Spudder, Wellhead, Roughneck, Sonar, Bathysph

**Fix:** split each district's list between Male, Female and Neutral, with rare initials first. Re-run `npm run test:names` for fold-collisions, because a few (Dory, Henri, Trinity, Harvest) are ordinary real given names.

---

## 16. New traits, skills, archetypes, quirks, stances

Names were checked with a case-insensitive grep against `traits.ts`, `archetypes.ts`, `quirks.ts`, `stances.ts` and `types.ts`: no hits, unless a note says otherwise. Existing skills (`types.ts:232-327`) include firecraft, waterlore, herbalism, knots, camouflage, evasion, rationing, salvage, ambush and animalHandling, so the proposals avoid those axes. `Ferryman` is reserved by the comment at `types.ts:87`, so it is not reused.

### Traits (16)

| id | trait | mods | engine hook |
|---|---|---|---|
| N1 | Stitch-Fingered | medicine 0.08, bleedResist 0.05 | a field dressing on an ally also cuts the ally's infection roll by 25% |
| N2 | Loud Heart | concealment −0.06, rapport 0.3 | allies in the zone gain `fearGain −0.1` (a morale aura) |
| N3 | Bad Knee | retreat −0.05, climbing proficiency floor −1 | cannot be picked for Patrolling; +1 fatigue on highland moves |
| N4 | Drowned Once | water −1.5, coldResist 0.15 | refuses swimming edges unless the zone is collapsing |
| N5 | Mud-Skinned | concealment 0.08, poisonResist −0.05 | the concealment bonus doubles in marsh/wetland biomes |
| N6 | Bell-Voiced | leadership 0.3, concealment −0.04 | `signallingPull` (`traitHooks.ts:305`) range +1 zone for their alliance |
| N7 | Two-Faced | treachery 0.15, suspicionResist 0.2 | each rumour they tell has a 30% chance to name a different subject |
| N8 | Kin-Seeker | allianceAffinity 0.25 | alliance offers to a same-district tribute cannot be refused on day 1 |
| N9 | Ash-Lunged | burnResist 0.2, fatigueDay 1 | smoke hazards deal half damage; sprinting proficiency −1 |
| N10 | Tin Ear | awarenessNight −0.4, sanityDrain −0.15 | ignores `Cannon-Counter`-style cannon fear and never gains fear from cannons |
| N11 | Hunger-Sharp | combatPower +1.0 while hunger < 30, hungerDrain +0.5 | a stance score bonus to Hunting while hungry |
| N12 | Borrowed Luck | odds 0.8 | the first lethal hit of the Games leaves them downed instead of dead, once |
| N13 | Bitter Root | forage 0.05, poisonResist 0.1 | a foraged item is never poisonous, but has a 20% chance of sanity −3 |
| N14 | Deadfall Mind | trapSkill 0.1, ambush 0.04 | traps they set in a zone they hold add +0.1 `lureAmbushBonus` |
| N15 | Slow Healer | medicine received −0.1, resolveDrift 0.2 | injuries last one extra cycle; resolve never drops from an injury |
| N16 | Keeps Watch Alone | awarenessNight 0.8, allianceAffinity −0.1 | on watch, `watchFailScale` (`traitHooks.ts:200`) ×0.6, but only when no ally shares the watch |

### Skills (6)

- **N17 angling.** Trained on water-zone forage. Adds a fish food source on any `water`-tagged zone; +4% food yield per level. Relieves the thin food supply in river and coast arenas.
- **N18 mimicry.** Trained by successful deceptions and false trails. Raises the chance that a rumour or false-sighting from this tribute is believed (on top of `rumourCredibility`), and allows a mutt-call lure.
- **N19 bartering.** Trained by completed trades (obligations.ts). Replaces the flat `haggle` trait key as the parley bargaining base, so Hard Bargain and Horse Trader become floors rather than the whole mechanic (see A6).
- **N20 weathercraft.** Trained each weather change the tribute survives in the open. Pre-empts `exposure.ts` rolls: −5% frostbite/heatstroke per level and one cycle of warning before a weather act.
- **N21 teaching.** Trained when an ally gains a proficiency level in the teacher's company. The ally gains +25% training on the teacher's best skill. It is the first skill that is valuable only inside an alliance, which helps diplomat, martyr and protector.
- **N22 resting.** Trained by uninterrupted rest cycles. +1 sanityRecovery and −0.5 fatigueNight per level. It makes Fortified/Tending time pay off.

### Archetypes (6)

- **N23 Firekeeper.** statBias intelligence 1, endurance 1; preferred Kindler, Flame-Tested, Salt-Cured; stance Fortified 0.5, Tending 0.3; objective hold 0.4. Signature *keepFire*: holds a fire three nights running, and every ally in the zone gets fatigueNight −2 and coldResist +0.2 for as long as the fire lasts. Ending a cycle beside a fire raises targetDraw by 0.5.
- **N24 Kingmaker.** charisma 2, intelligence 1; alliance 0.4, treachery 0.1; target `strongest`. Signature *crown*: steers the pickLeader score toward a chosen ally (+leadership 1.0) and takes a share of that ally's sponsor gifts.
- **N25 Ratcatcher.** agility 1, stealth 1; preferred Trapper, Knot-Tier, Beast-Wise; stance Baiting 0.6. Signature *pestSweep*: clears a mutt spawn from a zone with traps and gains animalHandling. The signature uses `muttHandlingScale` (`traitHooks.ts:354`).
- **N26 Pilgrim.** willpower 2, endurance 1; aggression −0.2; objective reach 0.6 toward a fixed landmark zone picked at the reaping. Signature *arrival*: reaching it gives resolveDrift +0.5 for the rest of the Games and a sponsor event.
- **N27 Mourner.** willpower 1, charisma 1; griefResist −0.2 but vengeanceEdge 1.5 against the killer of any ally. Signature *vigil*: stays a cycle with a fallen ally's body, gains sanity instead of losing it, and swears vengeance with a hunt bias. It turns the 14.5 vengeance oaths per run into a playable archetype.
- **N28 Lamplighter.** intelligence 2; caution 0.3; stance Patrolling 0.6 (lifting the 1.9% stance). Signature *beacon*: marks a safe route for the alliance, and allies moving along it take −30% hazard damage for one day.

### Quirks (6)

- **N29** "counts their steps between trees": navigation training +10%, nightMovement −0.1.
- **N30** "sleeps with one boot off": fatigueNight −0.5, retreat −0.02 at night.
- **N31** "licks the blade before a fight": intimidation 0.1, poisonResist −0.05.
- **N32** "keeps the first thing they find": capacity +0 but that item can never be traded or stolen.
- **N33** "hums a lullaby for the dead": griefResist 0.08, concealment −0.02.
- **N34** "never eats the last of anything": hungerDrain +0.3, and a meal that would empty their stock is skipped (`rationMeal`-style hook).

### Stances (3)

- **N35 Regrouping.** Conditional: allied, separated from the alliance, alliance zone known. It moves toward allies with `signallingPull`, fights only in self-defence, and takes −20% ambush. It takes share from Evasive, where separated allies currently end up.
- **N36 Mourning.** Conditional: an ally died in or next to the zone within 1 cycle. There is no movement for a cycle. The mourner gains sanity (griefResist doubled) and awareness −0.5 (vulnerable), and on exit swears vengeance on the known killer. This makes grief visible instead of a flat sanity hit.
- **N37 Sheltering.** Conditional: a weather act or exposure risk, with campSkill ≥ threshold. The tribute builds or uses a shelter, gets −50% cold/heat/frostbite rolls, spends 1 food and 1 fatigue, and cannot be hunted except by trackers. It takes share from Fortified and Desperate in weather arenas.

---

## 17. Suggested order of work

1. **K1–K5 (Career horn and fear), with the K6 guard,** then a 1,600-run `test:metrics` pass to rebalance the Career victor share in the mid-game.
2. **B1/B2** (convergence stranding and reopening), with a "nobody alive in a collapsed zone" invariant.
3. **U1/U2** (double commas in the feed, the epilogue dead end) and **W1** (the leaked zone label in the rescue-line death).
4. **A17/A18/A20/A21** (dead signatures, the hermit and diplomat logic gaps), then the reaping-trait trims A9–A16.
5. **R1/R2** (alliance cohesion floor, `endReason`), then T5/T6 (the gong decision driven by motive and horn plan).
6. **S1–S4** (surface the hidden side systems), H1/H2/S6 (achievement fixes).
7. Content waves: W3/W5 cause skins and codes → §9 deaths → §10 events for the thinnest arenas first (W7) → §16 traits/archetypes → §14 achievements → §15 names.
8. §4 QOL and §12 replayability.
