# Survival Games — AUDIT-14: current-code audit and expansion plan

Audited revision: [`77570e4`](https://github.com/icamcmusic-ship-it/survival-games/tree/77570e4) (merge of #103, the AUDIT-13 implementation). Audit date: 27 September 2026.

This is an audit and backlog; no production source was changed. **Confirmed** means reproduced by execution (seeded harnesses, the repo's `check-*` scripts, `test:metrics` at n=800, and Playwright/Chromium at 1280 px and 380 px in light and dark) or checked line by line in the source. **Plausible** means there is a clear code path that the sampled runs did not hit. Anything already fixed in `CHANGELOG.md` or in AUDIT-1…13 is left out, except where this audit found an AUDIT-13 fix not working.

**Naming constraint (unchanged):** one given-name field only. No surnames, surname pools, toggles, generation or hidden metadata. All sample lines use single given names.

**IDs are scoped to their section.** For example, §3's E1 is an engine bug, while E1 in an evidence table is a harness run. Cite them as "§3 E1", "§6 A12" and so on.

---

## 1. What matters most

1. **Two AUDIT-13 fixes aren't working (§6 W1–W2).** The seed-shrapnel death still leaks the internal sub-zone label, and `applyDamage` never calls `refineHazardCode`, so `hazard` remains the final cause in 9+ arenas. The six new cause codes cover 0.26% of deaths, and `electrocution` never fires (§3 E9).
2. **Undo and bets let the player cheat (§4 U2).** Undo can step back past the gong and reopen betting on a replay that is identical line for line. `cashOutBet` has no rewind guard.
3. **Save and share data can be lost (§8 S1–S3).** Run links drop districts 14–16 and still claim an exact replay. A null record-book entry crashes the Record Book. Importing a pinned Hall of Fame file wipes your own victors.
4. **Bugs in the new AUDIT-13 code (§3 E1–E8):**
   - 30 archetypes start day 1 in a stance whose precondition is false.
   - Salvage-law arenas duplicate corpse kit (122 sets in 40 runs).
   - Corpse caches are narrated as fled camps, and 48% of them land in collapsed zones.
   - Zone states keep ticking on collapsed zones.
   - Betrayal warnings go stale.
5. **Relationship arcs added by AUDIT-13 barely happen (§5 RB1–RB3).** Slow-burn romance fired 4 times in 200 runs. A sworn avenger kills their target 4.6% of the time and is killed by that target 12.5% of the time. Cooled oaths are re-sworn.
6. **The balance headline is partly a harness artefact (§7).** The Career edge is concentrated in 6-district fields (13.5% vs 3.4% win rate per head); in 12-district fields it is 4.42% vs 4.29%. The real weak districts are 3, 5 and 6. The trait and quirk tables are statistically flat, so they should not be tuned from.
7. **Staleness (§8 P, §6 W7).** About 200–300 templates appear in ≥75–80% of runs, mostly before the gong. After 30 runs only 20% of lines are new.

## 2. Evidence

The harness scripts live in the audit scratchpad and are not committed. The evidence tables for each section sit at the top of that section.

| Area | Harness / check | Headline |
|---|---|---|
| Engine | 184 seeded Games (all arenas plus procedural), invariants after every phase, 62 save/restore pairs | No NaN, "undefined" or placeholder text; 62/62 deterministic; median 443 ms per Game; 19 bugs |
| UI | `ui-test.mjs` plus Playwright repros, 1280/380 px, light/dark | 0 console errors, no overflow; 5 bugs; one 540 ms long task |
| Relations | 200 seeded runs | Median alliance life 4 cycles; Careers allied 98% of cycles; 9 bugs |
| Arenas | 6 seeds × 55 arenas (7,578 deaths) plus 8 seeds × 9 thin arenas | 5 arenas at >72% tribute kills; signature share 0–2% in 6 arenas |
| Balance | `metrics` n=800 (pass); own harness n=4,000 plus 1,800 (12 districts) and 800 (6 districts) | 14/198 traits outside the 95% CI (about chance) |
| Side/achievements/names | `check-achievements` (fails at 300 runs), `check-names` (pass, 4,633), replay-novelty over 30 runs | 72 achievements never unlock; 226 new names, 0 collisions |
| Soak | `test:sim` | No invariant violations |


---

## 3. Engine bugs and tribute logic


Audited: working tree at the "AUDIT-13 implementation" CHANGELOG entry. No `src/` or `scripts/` file changed. **Confirmed** = reproduced by the seeded harnesses below or verified line by line. **Plausible** = clear code path, not isolated in a run. Items already in AUDIT.md…AUDIT-13.md or fixed in the AUDIT-13 CHANGELOG are left out. B1 (living in collapsed zone), B4 and B6 from AUDIT-13 were re-measured and hold (see evidence), except where a new defect in the B6 fix is listed.

### Evidence

| Check | Result |
|---|---|
| Invariant harness `h14.ts`, **184 runs** (`A14-0..183`, all 45 arena ids + procedural, 1 in 3 with 8 districts), checked after every phase step | 0 NaN/`undefined`/`[object`/placeholder in text; 0 vitals out of [0,100]; 0 stack qty ≤0; 0 item objects shared by two inventories; 0 living tributes in a collapsed zone (B1 fix holds); 0 stuck weather chains; 0 runs that never end. **Found:** E1–E13 below. |
| Save/restore, `h14b.ts` (62 runs: JSON round-trip at step 18, replay to end, compare log text + status + kills + zones + inventories against the uninterrupted run) | **62/62 identical.** The new state (`zoneStates`, `weatherChain`, `deathSites*`, `relationsArc`, `mourning`, caches) serialises cleanly. |
| Salvage-law harness, `h14b.ts abattoir`, 40 runs | 372 "Nobody comes for…" caches; **122** dead owners with the same item ids in two caches (E2). |
| Betrayal-intent harness, `h14c.ts`, 120 runs | 39 warnings, 20 strikes by a warned tribute within 3 cycles; 7 warnings and 4 strikes across zones (E6). |
| Cause-code harness, `h14d.ts`, 150 runs, 3,465 deaths | New codes crush/impact/electrocution/sound/animal/exposure-pressure: **9 deaths total (0.26%)**, electrocution 0. 19 hazard deaths coded `tribute` (E9, E10). |
| Corpse-sweep harness, `h14e.ts`, 100 runs | 751 sweeps, 1,795 item entries; 0 lost to stack collapse, 0 unknown ids; 175 blooded weapons and 10 keepsakes re-minted as fresh items (E13). |
| Tribute-decision harness, `h14f.ts`, 92 runs | 14,349 scored stance decisions (43% "held"), top-2 margin median 1.59; objective `hunt` held in 40% of tribute-cycles vs Hunting stance 1.7%; same-archetype pairs in one zone share a stance 38%. |
| Performance | Median **443 ms**/Games, p90 666 ms, max 1,244 ms (full 24-tribute run incl. pre-games). No hot spot worth a finding. |

---

### Bugs (engine)

**P1** broken core behaviour or visible breakage; **P2** incorrect mechanics or misleading output; **P3** latent or maintenance.

**E1 — P1 — Confirmed — 30 archetypes open the Games in a conditional stance whose precondition is false, and D1 day is played in it unscored.**
- Measured: `openingStance` returns a conditional stance for 30 archetypes (Desperate for wildcard/confessor, Hunting for tracker, Nursing ×5, Shadowing ×4, Fortified ×9, Mourning for mourner, …). In 92 runs, 340/1,502 (22.6%) of living tributes start D1 day in one (Fortified 93, Scavenging 53, Nursing 49, Shadowing 45, Patrolling 43, Desperate 34 at full health). The D1 day `decisionTrace` is empty: the stance is never scored before that phase acts. `h14.ts` found 42 samples in 15/184 runs of **Mourning with no death to mourn** (A14-0 Cachet D1 day → D2 day; A14-1 Neptunia). `stickyHold` then keeps it for `minHold` 2, scoring 7.8 on no reasons. A Mourning tribute does not move (`dayNight.ts:1631`): 8/11 Mourning openers stayed put on D1 vs 31% of others.
- Cause: `stance.ts:1187-1196` `openingStance` = argmax of `stanceBias`, with no check against `STANCE_PROFILES[s].conditional`; `generator.ts:567`. `stickyHold` (`stance.ts:301`) accepts an incumbent that was never entered legally.
- Fix: in `openingStance`, skip conditional stances (fall back to the best non-conditional bias, else Defensive). In `stickyHold`, require `t.stanceHeld > 0` or a `stanceReady[stance]` stamp. Soak invariant: a conditional stance with a false precondition at `stanceHeld === 0` fails.

**E2 — P1 — Confirmed — Salvage law plus the B6 corpse sweep duplicates the dead's kit.**
- Measured: 40 abattoir runs: 122 dead owners whose items appear in two caches (A14b-0 Barkleigh `bow,shield`; Orelise `condenser,condenser`). 15 more in 92 mixed runs (procedural/Quell law).
- Cause: `combat.ts:2016-2020` copies a random subset of `victim.inventory` into a cache *without removing it from the body*. Two days later `arenaDynamics.ts:302-316` `sweepCorpseKit` pushes the whole inventory again. A looter in the 2-day window can also take the same item from the body.
- Fix: at `combat.ts:2020`, remove `kept` from `victim.inventory` (or set `victim.inventory = victim.inventory.filter(i => !kept.includes(i))`). Soak: across all caches + living inventories, a dead owner's item instance appears at most once.

**E3 — P2 — Confirmed — Every corpse cache is narrated as a camp somebody fled.**
- Measured: 850 lines in 181/184 runs: "Jerseline finds a camp in Sector 1 (Jungle) that somebody left standing: a cold fire, a windbreak still half up… they left fast" when the owner is a body swept two days earlier. 989 of 1,487 corpse caches are found this way.
- Cause: `sweepCorpseKit` (`arenaDynamics.ts:307-314`) reuses `abandonedCamps` with no kind; `checkAbandonedCamps` (`abandonedCamps.ts:140-150`) has one wording.
- Fix: add `kind: 'corpse' | 'camp' | 'scatter'` to the cache record and give `corpse` its own line ("what X was carrying, left where the hovercraft took them").

**E4 — P2 — Confirmed — Corpse caches pile up in collapsed zones and shadow each other.**
- Measured: 711/1,487 corpse caches (48%) are created in zones already collapsed, where nobody can find them. 117 samples (45 runs) of ≥3 unfound caches stacked in one zone. 8 samples (A14-39 The Bat Roost D12-13) where a fresh cache was unreachable because an expired one earlier in the list matched first.
- Cause: `sweepCorpseKit` ignores `collapsedZones` and the one-per-zone rule every other writer honours (`abandonedCamps.ts:77`, `combat.ts:2019`). `checkAbandonedCamps` uses `.find` and returns on the first match's age (`abandonedCamps.ts:103-107`).
- Fix: sweep into the nearest open zone (or drop the kit) when the zone is collapsed; merge into an existing unfound cache in the zone; filter expired caches *inside* the `find`, and prune caches older than `lifetimeCycles`.

**E5 — P2 — Confirmed — Zone states keep ticking and narrating on collapsed ground.**
- Measured: 1,210 `zoneStates` samples on collapsed zones (120/184 runs). 111 lines in 72 runs such as "Green is coming back through the ash in Ashen Woods…" and "The water goes down in Ruined Shacks…" for zones that were already closed.
- Cause: `arenaDynamics.ts:123-136` walks every `zoneStates` entry with no `collapsedZones` filter. The damage pass (`:111-120`) can also push the state of a zone a tribute was evicted from.
- Fix: delete `zoneStates[z]` when a zone collapses (in the eviction helper), and skip collapsed zones in both passes.

**E6 — P2 — Confirmed — The R3 betrayal warning and its strike happen across zones, and the strike still says "without warning".**
- Measured (`h14c`, 120 runs): 7/39 warnings with watcher and target in different zones; 4/20 follow-up strikes across zones. A14c-111 D5: "BETRAYAL: Steerling draws on Canvas in The Drowned Grove without warning." Canvas was in The Cornucopia, and Steerling had been shown counting Canvas's kit the cycle before. `h14.ts`: 17/184 runs with a cross-zone warning.
- Cause: `relationsArc.ts:57-67`/`:73-83` filter only by alliance, not zone; `resolveBetrayal` → `resolveKnife` (`betrayal.ts:258-266`) calls `resolveCombat` on whoever was passed. The knife line comes from the generic `ALLIANCE_TEXTS.betray` pool.
- Fix: require `m.zone === o.zone` for the tell and for the strike. If they are apart when it comes due, keep the intent for one more cycle or convert it to a `hunt` objective. Use a warned-strike line pool ("the thing everybody saw coming").

**E7 — P3 — Confirmed — The warning says "spends the evening" in the morning.**
- Measured: 35 of the warnings in 30/184 runs are logged with `phase: 'day'`.
- Cause: `processAlliances` runs before `processDayNight` (`simulator.ts:188`), so a warning written ahead of the day step is dawn; the text at `relationsArc.ts:89` is fixed.
- Fix: word by `state.phase` ("spends the grey hour before dawn…" / "the evening…").

**E8 — P2 — Confirmed — `betrayalIntent` is never cleared when the alliance ends or the target dies.**
- Measured: 23 samples of intent held toward a non-ally (11 runs; A14-3 Flavian→Aurick across three cycles) and 36 toward a dead target (11 runs).
- Cause: the intent is only consumed inside `betrayalIntent` for current members (`relationsArc.ts:59-63`). A tribute who leaves carries a loaded intent into their next group, and it fires on the first cycle both are allied again, with no new tell.
- Fix: clear `relationsArc.betrayalIntent` in `noteAllianceEnd` / wherever `allianceId` is deleted, and in `killTribute` for everyone targeting the victim.

**E9 — P2 — Confirmed — The six AUDIT-13 cause codes almost never fire.**
- Measured: 9 of 3,465 deaths (0.26%) in 150 runs: impact 5, crush 1, sound 1, animal 1, exposure-pressure 1, electrocution **0**. The changelog's "523 → 337 distinct causes" is an authored-string count, not what the death mix shows.
- Cause: `refineHazardCode` (`causes.ts:125-131`) acts only when the site passed `code: 'hazard'`, and `classifyCause`'s `HAZARD_RULES` pass (`:151-156`) only when `RULES` found nothing first. Most arena deaths are already coded by the site, or a broader `RULES` entry (`collapse`, `burns`, `fall`) matches first.
- Fix: add a `check-cause-codes` guard on **measured** share, not authored count (e.g. each new code ≥ 0.2% of arena deaths over 400 runs, or delete it). Re-code the D1–D76 site entries explicitly.

**E10 — P2 — Confirmed — Arena deaths worded "Killed by the …" are coded as tribute kills.**
- Measured: 19/3,465 deaths coded `tribute` with `lastDamage.kind === 'hazard'` and no killer: "Killed by the dust", "…tracker jackers", "…the urchin tide", "…the carousel", "…the cable". 186 authored `cause: 'Killed by …'` strings in `src/data` carry no `code:` on the same line (e.g. `proceduralBiomeEvents.ts:102,784`, `arenaFlavor.ts:984,1078,1739`).
- Cause: `RULES` `['tribute', /^Killed by |…/]` (`causes.ts:53`) runs before the damage-kind fallback.
- Fix: anchor the tribute rule to a real name (the site passes `code: 'tribute'` everywhere a tribute kills), or make `classifyCause` defer to `kind` when `kind !== 'tribute'`. Guard: `code === 'tribute'` ⇒ `killedBy` set.
- Also: `HAZARD_RULES` order sends "Crushed by a pressure ridge" to `exposure-pressure` (`causes.ts:97` before `:100`). Put `crush` first or narrow `/pressure/` to `pressure (drop|change)|decompress`.

**E11 — P2 — Confirmed — Kingmaker `crownedById` outlives the crown.**
- Measured: 52 samples in 10 runs of a tribute keeping `crownedById` after the Kingmaker died or crowned somebody else (A14-0 Quintus, crowned by Ouvert who is dead and whose `crownedId` is now `d2-male`). `crownLeadership` keeps paying them in `pickLeader`.
- Cause: `crownAlly` (`audit13Content.ts:501-502`) overwrites `t.crownedId` without clearing the old ward's `crownedById`; `crownShare` (`:85-87`) clears only the crowner's side, and only when the ward dies.
- Fix: clear the old ward's `crownedById` in `crownAlly`; in `tickAudit13Content`, drop `crownedById` when the crowner is dead or `crowner.crownedId !== t.id`.

**E12 — P2 — Confirmed — Ward and protector bonds survive the end of the alliance, including into vengeance.**
- Measured: 179 samples (34 runs) of `relationsArc.wardOf` pointing at a living ex-ally; 267 samples of `protectorBonds` to a living non-ally; **54 samples (9 runs) of a tribute bonded to protect somebody they have sworn vengeance on** (A14-1 Luster protects Dressel). The ward still inherits a trait when the elder dies, whoever killed whom.
- Cause: `wards` (`relationsArc.ts:268-306`) sets `wardOf` and pushes `protectorBonds` once (`:275-278`) and never re-checks `allied`; teaching needs only the same zone.
- Fix: in `wards`, clear `wardOf` and remove the `protectorBonds` entry when `!allied(elder, young)`, when either swears vengeance on the other, or on a betrayal between them. Skip inheritance if the ward killed the elder or vice versa.

**E13 — P3 — Confirmed — The corpse sweep re-mints items: blood, keepsake, durability and poison are reset.**
- Measured: 175 blooded weapons and 10 keepsakes in 751 sweeps (100 runs) come back as fresh items. A spent weapon (durability near 0) is refurbished to full.
- Cause: `arenaDynamics.ts:313` stores `items: t.inventory.map(i => i.id)`; `abandonedCamps.ts:130-133` mints by id.
- Fix: let a cache hold `Item[]` (or `{id, quality, durability, bloodDrawn, poison}`) and hand the instances over; keep `keepsake` off (it is the owner's).

**E14 — P3 — Confirmed — The finale mutation says "overnight" but fires in the day.**
- Measured: 102/184 runs, D8 `day` phase. Cause: `arenaDynamics.ts:161-172` runs in both phases and fires on the first tick of day 8. Fix: gate it on `time === 'night'`, or word it by phase.

**E15 — P3 — Confirmed — The Cornucopia is permanently haunted.**
- Measured: `deathSites[horn] ≥ 2` in 184/184 runs; mean 10.3 deaths recorded there. Everyone at the horn loses `hauntedSanity` every phase for the rest of the Games. The late-game positioning rule pulls high-risk tributes *to* the horn (`movement.ts` endgame block).
- Cause: `arenaDynamics.ts:177-190` counts bloodbath deaths and never decays.
- Fix: exclude bloodbath deaths (or `phase === 'bloodbath'`), and decay the count with `regrowthCycles` like other zone states.

**E16 — P3 — Confirmed — Doubled words from templated station and zone names.**
- Measured: 48 lines in 35/184 runs. "the The Seep waterline" ×14 (`flavorText.ts:3828` "the {zone}" + zone names starting with "The"). "in flooded Flooded Terraces" ×9 (`zoneEffects.ts:421,427`). Training stunts: "the climbing rig rig", "the shadow drill drill", "grappling mat mat" (`training.ts:1425,1465` + station names that already end in rig/drill/mat). "a Solar Still still good" (item name collision, sponsor line).
- Fix: an `articleZone()` helper that drops a leading "The" after "the"; skip "flooded" when the zone name contains it; station templates use `{station}` alone. Add `/\b(\w+) \1\b/i` (minus an allow-list) to the soak placeholder check.

**E17 — P3 — Plausible — Some movement helpers ignore severed edges.**
`freshGround` (`intent.ts:294`), `layFalseTrail` (`intent.ts:249`), `stance.ts:222`, `encounters.ts:1154`, `arenaSignature.ts:1463,1786` and `triangles.ts:147` call `reachableZones` without `severedEdgeSet`. `freshGround` feeds a `reach` at `encounters.ts:1018`. A decoy trail can be laid across a cut bridge. Fix: pass `severedEdgeSet(state)` everywhere, or make it the default inside `reachableZones`.

**E18 — P3 — Plausible — A Pilgrim whose landmark collapses keeps a vow it can never keep.**
`pickLandmark` runs only while `!t.pilgrimZone` (`audit13Content.ts:47,76-82`). When the zone collapses, the pull and the arrival signature are dead for the rest of the run. Fix: re-pick (with a "the place they swore to is gone" beat) when `pilgrimZone` is in `collapsedZones` before arrival.

**E19 — P3 — Confirmed — The slow-burn line counts cycles, not consecutive nights.**
`relationsArc.ts:223-228` increments `rapport` on any cycle (day or night) that passes the chance roll, never resets when they are apart, then prints "the same watch for N nights running". Fix: count only night cycles in the same zone, and reset on a cycle apart (or reword).

---

### Tribute logic: robustness and complexity

Measured baseline (`h14f.ts`, 92 runs; stance census from `h14.ts`, 184 runs, 29,944 living tribute-phase samples): Evasive **32.7%**, Aggressive 24.3%, Defensive 11.8%, Scavenging 4.7%, Fortified 4.1%, Baiting 3.3%, Nursing 2.7%, Patrolling 2.5%, Tending 2.0%, Sheltering 2.0%, Shadowing 1.9%, **Hunting 1.7%**, Parleying 1.5%, Hiding 1.5%, Regrouping 1.4%, Desperate 1.1%, Mourning 0.9% (16% of it bogus, E1). 43% of scored decisions are "held" by hysteresis. Objective census (16,391 tribute-cycles): `hunt` **40%**, `reach` 30%, `protect` 12%, `flee` 7%, everything else <3%.

**T1 (P2, Confirmed): stance choice is a pure argmax.** `stance.ts:1037-1055` sorts the scores and takes `ranked[0]`; the only randomness is upstream in the signals. Two tributes of the same archetype in the same zone share a stance 38% of the time (409/1,067 pairs), and the median top-2 margin is 1.59, so the winner is rarely in doubt. *Fix:* sample from a softmax over the top 3 with temperature `0.25 + 0.5 × confusion + 0.2 × (1 − willpower/10)`, keeping hysteresis. Rested, disciplined tributes stay near-deterministic; exhausted or panicking ones make human mistakes.

**T2 (P2, Confirmed): `hunt` is the default objective, and it almost never becomes the Hunting stance.** 40% of tribute-cycles carry `objective.kind === 'hunt'`, but Hunting is 1.7% of stances. The precondition (`stance.ts:313-318`) requires tracking ≥ `trackingMin` or a vengeance oath. The objective drives movement toward the quarry while the stance says Evasive or Defensive, which reads as an aimless "hunt". *Fix:* when the precondition fails, downgrade `hunt` to `stalk` (follow at one zone) or `scout`. Or give Hunting a lower tracking floor that scales the find chance, so it is a weaker hunt rather than an unreachable one.

**T3 (P2, Confirmed): any vengeance oath switches off all person-fear in movement.** `movement.ts:105`: `hunting = isAggressiveStance(t.stance) || ensureMemory(t).vengeance.length > 0` removes the fear penalty for *every* feared tribute, not just the sworn one. Measured effect is small today (moves into the zone of a feared ≥50 non-target: 8.5% with an oath vs 7.6% without) because fear is rare after K3. It becomes exploitable as soon as fear is re-tuned. *Fix:* skip the penalty only for zones where the feared person *is* a vengeance target; keep it for everyone else.

**T4 (P2, Confirmed): the vengeance pull needs any rival, not the target.** `movement.ts:78`: `if (hunted.length > 0 && rivals > 0) score += 4`. `rivals` is the count of remembered rivals of any kind in the zone, so the flat +4 fires wherever the target is believed to be *and* somebody else was seen. With no witness, the oath does not move the tribute at all. *Fix:* score `+vengeancePull × believedConfidence(target, z)`, decaying with `cyclesSinceContact`, independent of other rivals.

**T5 (P2, Confirmed): risk tolerance knows nothing about the room.** `risk.ts:26-47` combines temperament, own health, own kit, day and field size. It has no term for allies present, the strongest opponent in the zone, fear of anyone here, or being hunted (`isBeingFollowed` exists in `intent.ts:285` and is unused here). The stance table, hunt scorer, destination scorer and retreat roll all read this one number. *Fix:* add `+0.1 × alliesHere (cap 0.3)`, `−0.3 × max fearFraction of occupants`, `−0.15 if isBeingFollowed`, `+0.1 × (ownPower − bestHostilePower)/10`, all read from existing helpers.

**T6 (P2, Confirmed): destination scoring is one hop deep.** `pickDestination` (`movement.ts:29-229`) scores only adjacent options. Water-seeking fires only when the adjacent zone itself has `waterSource` (`:44-47`); a tribute two hops from the only river random-walks. `errandChain` (`intent.ts:61-94`) plans by `hopsTo`, but only when a goal exists. *Fix:* add a potential-field term: for each option, `max over targets (value / (1 + hops))` for water, food, allies and the vengeance target, using `hopsTo` with collapsed and severed edges. That is cheap at ≤30 zones.

**T7 (P2, Confirmed): the new stance bases swamp the scorer.** `AUDIT13_CONTENT.regroupingBase 9.5`, `mourningBase 8.5`, `shelteringBase 6.8` (`balance.ts:11225-11242`) against 3–6 for the core stances. Whenever a precondition holds they win outright (E1's Mourning scored 7.8 on no reasons). Regrouping's precondition is "any ally elsewhere". *Fix:* scale the bases by the signal: Regrouping by `hops to nearest ally × regard`; Mourning by `regard(victim)/100`; Sheltering by forecast severity. Give each a reason entry so `decisionTrace` explains it.

**T8 (P2, Confirmed): betrayal intent is a static product with a fixed one-cycle fuse.** `relationsArc.ts:73-83`: `ambition × distrust × kit × fieldScale`, threshold, then strike next cycle unless the group broke. The target's reaction never enters it: seeing the tell, changing zone, sleeping apart, pre-empting. *Fix:* the target (and allies with awareness ≥ X) roll to notice the warning. Noticing sets `watchful` (a sleep/zone choice), lowers the betrayer's success, or triggers `preemptiveBetrayer` against them. The fuse length is `1–3` cycles by treachery and opportunity (target asleep, alone in zone).

**T9 (P3, Confirmed): fear is personal-only; it never transfers or generalises.** AUDIT-13 added resolution: "saw them bleed" and "survived them" (`combat.ts:1154,1390`) and the reality correction (`:1166`). But fear is still written only by direct contact or witnessing (`addFear`, `fear.ts`). A tribute whose ally was killed out of sight fears the killer no more than a stranger, and a tribute holding many sworn oaths against them ("wanted") is not feared for it. *Fix:* on an ally's death with a known killer, `addFear(t, killer, 10 × regard/100)` (discounted for Careers per K3). Add fear of tributes with ≥3 kills believed through rumours (`rumourPull` already carries occupancy beliefs).

**T10 (P3, Confirmed): memory is personal but never wrong in a structured way.** `rememberedPlaceOf` / `believedIn` decay confidence, but there is no model of *where somebody would go* from their last sighting (toward water, toward allies, away from the horn). The tracker's advantage is just a proficiency number. *Fix:* project a quarry's believed zone one hop along its known objective or needs (thirst → water) with confidence × 0.6. Trackers project two hops. That turns hunting into prediction rather than following a stale pin.

**T11 (P3, Confirmed): the kingmaker picks the ward by `trainingScore + kills`.** `audit13Content.ts:496-500` is a one-line reduce. It ignores regard, trust, whether the candidate is even in the zone ("where everybody can hear"), and whether the candidate would crown back. *Fix:* weight by `trust × (trainingScore + kills + leadership) × sameZone`, and let a crowned ally refuse (pride trait, rival).

**T12 (P3, Confirmed): ward selection is first-found.** `relationsArc.ts:270-274`: `alive.find(o => age >= elder && allied)`, so the ward goes to whichever elder comes first in array order, not the closest or most caring one. *Fix:* choose the elder with the highest `getRel(elder, young) + protectiveness` in the same zone. Make the bond two-way: the ward regroups toward the elder, and the elder takes a hit to risk tolerance when the ward is downed nearby.

**T13 (P3, Confirmed): Sheltering is available almost everywhere, all run.** `shelteringAvailable` (`audit13Content.ts:185-192`) returns true in any arena with `climateOf(arena)`, whether or not the weather is bad this cycle. The W13 cold night rule (`arenaDynamics.ts:149`) reads only printed `shelterQuality` and ignores the Sheltering stance and a built camp. So the posture that exists for cold nights does nothing against the cold night rule. *Fix:* gate on the current climate severity or an active front. In the cold rule, multiply fatigue by `exposureScale(ctx, t)` and by `hasCamp(ctx, t, 'shelter') ? 0.5 : 1`.

**T14 (P3, Confirmed): partner search is one-shot and day ≤ 2 only.** `relationsArc.ts:170-181` sets one `reach` to the last-seen zone on day 1–2 if the objective is empty or `survive`. It never repeats and never tracks a partner who is moving. With 40% of tribute-cycles on `hunt` (T2), the "empty objective" gate rarely opens. *Fix:* let the search replace any non-urgent objective, re-aim on each fresh sighting or rumour, and end with a meet (alliance offer) or with evidence of death (cannon + district).

**T15 (P3, Confirmed): the endgame horn pull is a flat bonus by risk sign.** `movement.ts` endgame block: `riskTolerance > hornEdge` → +pull toward `/cornucopia/i`, else toward any elevated zone. It ignores where the other finalists are believed to be and what the horn now costs (E15 haunting, finale ruin). *Fix:* score endgame ground by expected encounter (a believed finalist within one hop), by cover, and by resupply (`restockCornucopia`). Let a high-risk finalist *hunt the believed finalist* rather than the horn.

**T16 (P3, Plausible): the opening stance is archetype-only (see E1).** Beyond the bug, the opening posture ignores the gong decision (`gongDecision` flee/edge/horn), the kit grabbed and the bloodbath outcome. *Fix:* after `processBloodbath`, run one real `updateStance` pass so D1 day starts from a scored stance: someone who fled with nothing opens Evasive or Scavenging; a Career who took the horn opens Patrolling.

---

#### Harness files (scratchpad)
`h14.ts` (invariants, 184 runs), `h14b.ts` (save/restore, salvage, D1 stance), `h14c.ts` (betrayal intent), `h14d.ts` (cause codes), `h14e.ts` (corpse sweep), `h14f.ts` (decision metrics), `dbg1.ts`/`os.ts` (E1 trace and archetype list). Raw output: `h14-184.txt`, `h14d.txt`.

---

## 4. UI bugs and QOL/UX


Scope: the UI after the AUDIT-13 implementation. Items already reported in AUDIT-13 §3.3 (U1–U7) and §4 (Q1–Q10), or in earlier AUDIT*.md files, are left out. Nothing in `src/` or `scripts/` was changed.

### Evidence

| What | How | Result |
|---|---|---|
| Repo smoke suite | `CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node scripts/ui-test.mjs` against `npx vite --port 3000` | All steps pass, "No errors". Note: the suite fails to launch without `CHROMIUM_PATH`, because the installed playwright wants headless_shell-1234 and only 1194 exists. |
| Exploratory drives | `scratchpad/audit/x1.mjs` (1280 light and 380 dark), `x2`–`x5.mjs` (autoplay, undo, 380 footer), seed `AUDIT14` | Console errors and warnings: 0 on both passes. Screenshots are in `scratchpad/audit/shots/`. |
| Long tasks | PerformanceObserver `longtask`, 12 districts, 1280 | Pre-Games stages: 6 tasks, max 167 ms. Run to end (823 ms wall): 10 tasks, max **540 ms**, sum 2.3 s. Chronicle paging, search typing and palette: 0 tasks over 50 ms on a 9-day log. Hall of fame: 1 × 95 ms. |
| Overflow and clipping at 380 | Scan of elements whose right edge passes the viewport, plus leaf elements whose content is clipped | No horizontal overflow. Every clip hit was an sr-only hint span (expected). |
| Debrief height | `scrollHeight` at 1280 | 4,985 px. The AUDIT-13 Q1 collapse holds. |

### UI bugs

**U1 — P2 — Confirmed — Autoplay stalls for good after the command palette opens and closes.**
- Repro (`x4.mjs`):
  1. Open the chronicle, set the pace to 2s and press Play.
  2. Press Ctrl+K, wait 2.5 s, then press Escape.
  3. The footer is identical 6 s later ("INTO THE NIGHT"), while the button still reads "Pause autoplay" (`aria-pressed=true`).
  4. The stall reproduced on both passes in `x1.mjs` (1280 and 380).
  5. Control run: the chronicle's own `?` overlay resumes fine, because its state lives in the screen and closing it re-renders.
- Cause: `ChronicleScreen.tsx:483-491`. The effect has no dependencies, so it only re-arms on a re-render. When the timeout fires while `isDialogOpen()` is true, it just `return`s. The palette is mounted in App, so closing it never re-renders ChronicleScreen, and no new timer is ever scheduled.
- Fix: when a dialog is open, re-arm inside the callback (`id = setTimeout(tick, 500)`), or subscribe to the dialog stack in `ui/useDialogFocus.ts` (a `useSyncExternalStore` on the stack length).

**U2 — P2 — Confirmed — Undo past the gong reopens betting on a future you have already seen, and the replay is deterministic.**
- Repro (`x3.mjs`, `x4.mjs`):
  1. Run the bloodbath.
  2. Press Undo twice. The footer returns to "SOUND THE GONG · stage 9/9", and the arena shows "YOUR BETS" open again.
  3. Run the bloodbath again: the same deaths come out, line for line (`deterministic true`).
  4. So a player can watch the bloodbath (or any of the 16 rewindable phases), undo, and place side bets or a victory bet, knowing the result.
  5. `cashOutBet` works the same way: advance, see your tribute about to die, undo, then cash out at the price from before the death.
- Cause:
  - `store/gameStore.ts:1164-1175`: `canStepBack` and `stepBack` only refuse `ended`.
  - `engine/sideMarkets.ts:52-58`: `sideBettingOpen` looks at phase only.
  - `gameStore.ts:719-742`: `cashOutBet` has no rewind guard.
- Fix (any one of these):
  - Record a `highWaterPhase` or `sawGong` flag in the store that undo does not restore. Refuse bets and cash-outs while `rewindStack` has moved back from it.
  - Or block Undo across the gong while any bet or side bet exists, and show a tooltip "Undo is locked once wagers are live".
  - Or clear bets placed after the high-water mark.

**U3 — P2 — Confirmed — At phone width, the chronicle's phase ticks render as overlapping blocks.**
- Repro (`x5.mjs`, `shots/380-footer.png`):
  1. At 380 px, advance to day 1 night.
  2. The ticks become 40×70 px cells 28 px apart. Neighbouring borders cross each other, the current tick is a solid 40×70 red slab, and the rows overlap by 22 px.
- Cause: `index.css:1623-1629` gives `.scrubber-tick` transparent padding and `background-clip: content-box`. The inline `style={{ background: … }}` at `ChronicleScreen.tsx:758-762` uses the `background` shorthand, which resets `background-clip` to `border-box`. The border also sits on the padded box, not on the 10×20 mark.
- Fix: use `backgroundColor` in the inline style. Draw the tick's outline with an inset `box-shadow` or an `::before` sized to the content box, not `border`.

**U4 — P3 — Confirmed — On a phone, the chronicle's advance, Play and Undo controls sit at the very bottom of a page about 6,900 px tall.**
- Repro (`x5.mjs`): at 380 px, on day 1 night, the footer is `position: static` at y = 6,257, and "Advance the Games" is at y = 6,568 of 6,922. Every stage needs a long scroll, or 13 swipes, to reach the button. AUDIT-13 U6 fixed only the empty state.
- Cause: `ChronicleScreen.tsx:717`, where the footer is `sm:sticky sm:bottom-0` only.
- Fix: below `sm`, add a compact sticky bar (Prev · Play · primary advance) with `padding-bottom: env(safe-area-inset-bottom)`, or a floating primary button. The full footer stays at the end of the page.

**U5 — P3 — Plausible — The chronicle's keys overlay does not cover the page's other keys.** It lists ←/→, N, / and ?, but Ctrl+K (palette) and Escape work on the page and are not shown. The overlay is at `ChronicleScreen.tsx`, `showKeys`. Fix: add the global keys, or link to How to Play §keys.

### QOL, UI and UX improvements

**Q1 — Run to end blocks the main thread for up to 540 ms** in one task (10 tasks, 2.3 s total, 12 districts). It is chunked, but the chunks are too large for the Cancel button to feel responsive. Where: the `runToEnd` loop in `gameStore.ts` (around `activeRun`). Yield by elapsed time (about 30 ms, via `scheduler.yield` or `setTimeout 0`), not by phase count.

**Q2 — Make N useful when you are not on the last page.** Right now it silently does nothing (`ChronicleScreen.tsx:552-554`). Make it jump to the last page on the first press and advance on the second, and give brief feedback ("Caught up — press N again to run the next stage").

**Q3 — Show the autoplay state visibly.** A small "Playing · 2s" chip with a countdown ring on the Play button, and an announcement in the live region when autoplay stops (at the epilogue, or when a dialog pauses it). Today, stopping at the epilogue changes the Pause icon back with no message (`ChronicleScreen.tsx:481`).

**Q4 — Keep one tap target per tick on phones.** After U3, the targets still overlap (40 px wide on a 28 px pitch), so a tap on one tick can land on its neighbour. When there are more than about 12 pages, replace the tick grid below `sm` with the existing "Jump to a day" select plus a single range slider. Where: `ChronicleScreen.tsx:733-765`.

**Q5 — Give Undo a label and a preview.** The Undo button is icon-only in the footer, with only a hover Hint, so a touch user has no idea what it will rewind. Put the target in its label, e.g. "Undo: back to Day 4 — Night" (from `gameActions.checkpoints()[0]`), and show it as visible text at `sm` and above.

**Q6 — Test harness:** `scripts/ui-test.mjs:14` should fall back to `/opt/pw-browsers/chromium-*/chrome-linux/chrome`, or read `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. As written, `npm run test:ui` fails on this box without `CHROMIUM_PATH`, because the playwright and browser versions do not match.

---

## 5. Relationships and alliances


Scope: relationships.ts, alliance*.ts, betrayal.ts, relationsArc.ts, vengeancePact.ts, traitHooks.ts (turncoat), phases/alliances.ts (romance), memory.ts (oaths/decay). Deduplicated against AUDIT-13 §6 R1–R7, §3.2 B4, and the AUDIT-10–12 relationship sections. Nothing in src/ or scripts/ was modified.

### Evidence

| Check | Result |
|---|---|
| `rel14.ts` (scratchpad), 200 runs `A14R0..199`, all arenas plus procedural × 4 configs (the check-audit13-relations matrix), 3,828 tributes | Alliances 1,596 (242 stillborn). Median life excluding stillborn is 4 cycles (mean 4.5), so the R1 guard holds. Career allied 98%, non-Career 60%. Betrayals 241 (1.2/Games). Romances 19. Vengeance sworn 2,553. |
| `an.ts`: log and outcome join over the same 200 runs | Oath paid by the swearer 118/2,553 (4.6%). Swearer killed by the target 319 (12.5%). Warning → betrayal within 1 day 25/103 (24%). Romances: 14/19 performed, 14/19 both dead. Re-sworn after cooling: 11. |
| `inv2.ts`: record vs `allianceId` truth after every step, 6,428 alliance snapshots | 13 records with fewer than 2 true members, 13 whose `memberIds` disagree with truth, 1 whose `leaderId` is outside the group. None are dead-id cases (AUDIT-13 B4 fixed those). |
| `inv3.ts`: ward and coup tracking, 200 runs | 620 ward-cycles; in 162 (26%) the elder is alive but not allied; in 24 they are hostile (regard below 0). 2 of 5 turncoat-deposed leaders are back in the group that threw them out. |
| `one.ts`: single-run traces (`IDX`/`WHO`/`C`) | Reproduces each stale-record path: run 57 c4 `alliance-dispute-lost`, run 41 c6 `turncoat-coup`, runs 18/29/66 `succession-split`, run 90 c11 romance. |

#### Measured tables (n=200)

**Alliance end reasons** (chronicle, stillborn excluded from lifetimes)

| endReason | n | median life (cycles) | mean |
|---|---|---|---|
| attrition | 641 (242 stillborn) | 3 | 4.8 |
| splinter | 264 | 3 | 4.0 |
| betrayal | 234 | 3 | 4.4 |
| pact-expired | 203 | 4 | 4.5 |
| walkout | 152 | 4 | 5.0 |
| merged | 97 | 3 | 3.6 |
| victor | 4 | 7 | 5.0 |

Snapshot group sizes (end of each step): 2: 3,282 · 3: 1,435 · 4: 581 · 5: 495 · 6: 620 · 7: 6 · **1: 9**. Pairs dominate (51%).

**Formation rate** (share of tributes ever in an alliance / win %)

| Group | n | allied | win |
|---|---|---|---|
| Career | 1,200 | 98% | 7.9% |
| non-Career | 2,628 | 60% | 4.1% |
| D1 / D2 / D4 | 400 each | 97 / 98 / 99% | 5.3 / 6.0 / 12.5% |
| D3 / D5 / D6 | 400 each | 57 / 63 / 52% | 3.3 / 4.5 / 3.0% |
| archetype high: healer-pacifist, quartermaster, archivist, kingmaker, forager | 40–124 | 90, 86, 83, 82, 81% | |
| archetype low: beast, hermit, mercenary, saboteur, wildcard | 40–106 | 47, 48, 55, 55, 58% | hermit 0.0%, engineer 0.0% win |

Victor was ever allied in 188/200 runs. Going solo almost never wins (12/200).

**Relationship values** (75,100 directed edges at game end)

| bin | 0 | ±20 | ±40 | ±60 | ±80 | ±100 |
|---|---|---|---|---|---|---|
| + | 41,406 (at 0) | 9,758 | 2,528 | 2,085 | 2,413 | 3,496 |
| − | | 8,703 | 2,457 | 1,035 | 700 | 519 |

- Exactly +100: 1,428 edges (1.9%). Exactly −100: 226 (0.3%).
- The positive side saturates: the ±100 bin is larger than ±60 and ±80. The negative side does not.
- Asymmetry: 2,697/37,550 pairs (7.2%) differ by 40 or more. Only 167 (0.4%) are opposite-signed with both above 20 in magnitude, so one-sided love or hate is almost absent.

**Behavioural reach** (what relationships actually do)

| Beat | 200 runs | per Games |
|---|---|---|
| rescue-line / held / failed / remembered | 516 / 192 / 324 / 355 | 2.6 |
| guardian-stand | 16 | 0.08 |
| shared-camp | 399 | 2.0 |
| debt-repaid | 670 | 3.4 |
| kills by someone who was ever an ally | 378/2,384 (15.9%) | |
| district partner killed partner | 85/1,914 pairs (4.4%; AUDIT-13 3.3%) | |
| alliance-reunion / alliance-feud | 28 / 3 | |
| romance-slow-burn / reveal / tragedy | 4 / 19 / 16 | |
| ward-bond / ward-inheritance | 65 / 20 | |
| betrayal-warning | 103 (25 paid) | |
| vengeance-sworn / cooled / paid (pact) | 2,553 / 277 / 64 | |

There is no typed food-sharing beat. Sharing lives only in `sharedCache` and dispute rationing, so "allies share food" can't be counted from the log.

**Most repeated relationship lines** (names masked, 200 runs): `truce-outlived` "…ends the way most of them do: X is dead, and X never once broke it." ×626 (3.1/Games); `vengeance-pacts` single template ×386; `district-bonds` ×311; `station-bond` ×277; `obligation-made` "…will not go down alone" ×277; `vengeance-cooled` ×277 (a single template); `betrayal-warning` ×103 (a single template); `ward-bond` ×65 (a single template).

### Relationship/alliance bugs

##### RB1 (P2, Confirmed): R5 slow-burn romance is effectively unreachable
- Measured: 4 `romance-slow-burn` in 200 runs. Total romances are 19/200, below AUDIT-13's pre-fix 17/160.
- Cause: `relationsArc.ts:217-223` needs `romanceRampCycles: 7` successes at `romanceRampChance: 0.12` per cycle (`balance.ts:11107-11108`), and only while both are allied **and in the same zone**. That is about 58 co-located allied cycles, in runs of about 20 cycles. P(≥7 of 20 trials at 0.12) ≈ 1%; with the stood-by doubling (0.24) it is ≈ 18%, and co-location cuts the trial count further. The rapport counter also never decays, but it rarely gets far enough for that to matter.
- Fix: make ramp chance about 0.35 (0.6 after a stood-by) with 4 cycles, or count shared-camp, rescue and watch beats directly instead of rolling. Guard: slow-burn ≥ 0.15/Games in `test:audit13-relations`.

##### RB2 (P2, Confirmed): vengeance still almost never pays; oaths kill the swearer
- Measured: the swearer kills the target in 118/2,553 oaths (4.6%). The swearer is killed by the target in 319 (12.5%), 2.7× as often. The target dies to someone else in 2,043. R6 (cap, cooling) cut the noise, but did not add a payoff.
- Cause: `relationships.ts:462-471` forces `Aggressive` stance on every oath, against a killer who has just proved they win fights. Only pacts get a `vengeance-paid` resolution (`vengeancePact.ts:150-172`). A solo oath has no hunt-with-caution or ambush mode.
- Fix: a solo oath should set a `hunt` objective with a `waitForAdvantage` flag (strike only when the target is downed, asleep or wounded). Add a `vengeance-paid` beat for solo payers. Report paid/sworn and swearer-killed/sworn in the guard.

##### RB3 (P3, Confirmed): `relationsArc.cooled` is written but never read, so a cooled oath is re-sworn
- Measured: 11 oaths re-sworn against a target the same tribute had already `vengeance-cooled`.
- Cause: `relationsArc.ts:256` appends to `arc.cooled`. `swearVengeance` (`memory.ts:516-520`) never consults it, and nothing else reads it.
- Fix: in `swearVengeance`, skip (or require a fresh witnessed grievance) when the target is in `relationsArc.cooled`. Alternatively, log a "the old oath comes back" variant.

##### RB4 (P3, Confirmed): turncoat coup applies no betrayal fallout; the deposed leader rejoins
- Measured: 2 of 5 deposed leaders (run 48 `d9-female`, run 121 `d2-female`) are later members of the same record again.
- Cause: `traitHooks.ts:428-452` deletes `leader.allianceId` and adjusts regard and suspicion. It does not call `applyBetrayalFallout`, does not add to `expelledIds` or `betrayedBy`/`timesBetrayed`, and does not update `memberIds`. The recruitment filter and the betrayal-aftermath beat (`phases/alliances.ts:1407`) never see it.
- Fix: route it through `applyBetrayalFallout(ctx, t, leader, members)`, push `leader.id` to `record.expelledIds`, and strip it from `memberIds`.

##### RB5 (P3, Confirmed): the ward edge outlives the alliance
- Measured: 162/620 ward-cycles (26%) have a living elder who is not allied. In 24 the regard is negative. 6 elders killed their own ward.
- Cause: `relationsArc.ts:268-297` sets `wardOf` and `protectorBonds` once and never clears them. Teaching (`:285-289`) checks only the zone, and inheritance (`:291-296`) fires regardless of how the pair parted.
- Fix: clear `wardOf` and the protector bond when `!allied(elder, young)` and regard is below 0. Give inheritance a line keyed to estrangement ("learned it from someone they stopped speaking to"), or skip it.

##### RB6 (P3, Confirmed): living departures leave the record stale (residual of AUDIT-13 B4, which fixed dead ids only)
- Measured: 13/6,428 end-of-step snapshots have `memberIds` ≠ the `allianceId` truth, and 13 have fewer than 2 true members. There is 1 `leaderId` outside its group (run 90 c11: the leader walked into `lovers-…`, and both lovers stay listed in the old record).
- Cause: about 16 sites `delete t.allianceId` without touching the record: romance `phases/alliances.ts:1468-1477`, dispute walkout `allianceDispute.ts:448`, turncoat `traitHooks.ts:443`, and others. `memberIds` is refreshed only in `reconcileAlliances` (`alliance.ts:835`), which runs at `phases/alliances.ts:800`, before the relations arc and romance. Readers: `WhatIfPanel.tsx:98,131`, `gameStore.ts:1153`.
- Fix: add one `leaveAlliance(state, t, reason, byId)` helper that deletes the id, filters `memberIds`, re-picks the leader, and calls `noteAllianceEnd`, then replace the delete sites with it.

##### RB7 (P3, Confirmed): a succession split can create one-person "groups"
- Measured: 6 of the 13 truth-below-2 records are succession splits (runs 18, 29, 66, 75, 122, 178; e.g. `alliance-succession-floor-pact-d10-male-9` = [d11-male]).
- Cause: `alliance.ts:545-566` accepts `withHeir.length >= 1 && withFavourite.length >= 1` with a total of 3. `registerAlliance` then gives the lone side a record, pact and chronicle entry, and the other side keeps a record with 1 member until the next reconcile.
- Fix: when either side is below 2, treat it as the odd one out walking (`walkout`, with grudge regard) and do not register a splinter record.

##### RB8 (P3, Confirmed): three quarters of betrayal warnings never pay off
- Measured: 25/103 `betrayal-warning` are followed by a betrayal by that pair within 1 day. In 17 the warner does kill the target later, by other means.
- Cause: `relationsArc.ts:61-68` silently consumes the intent if the victim is downed, the group split, or an oath refuses. There is no "stood down" beat, and the warning is a single template (`:88-93`).
- Fix: log a `betrayal-stood-down` line when an intent lapses, so the tell resolves on screen either way. Add 3–4 warning variants keyed to the motive (kit, distrust, endgame).

##### RB9 (P3, Plausible): romances are overwhelmingly performed, not sincere
- Measured: 14/19 romances carry a performer (`performed-bonds` 14). There are only 5 sincere romances in 200 runs, and 14/19 couples both die.
- Cause: `phases/alliances.ts:1236-1253` promotes to "performed" whenever the other party has showmance, charisma at or above `performerCharisma`, or `performsForCameras`. With RB1 closing the sincere slow-burn path, the showmance-vs-real twist has almost no real side.
- Fix: follows from RB1. Also cap the performed share, or require the performer's regard to be below the smitten's.

### Relationships and alliances: improvements

- **R1: trust tests.** Build on `betrayalIntent` and `trustOf`. Before a group admits a recruit or names an heir, hand the candidate the cache for a night. A tribute with a `betrayalIntent` has a treachery-weighted chance to skim, and a watcher may catch it (`rumour-caught` machinery). This makes the 7.2% asymmetric pairs visible, and makes warnings (RB8) resolve.
- **R2: alliance roles with teeth.** `record.roles` exists and `role-neglected` fires. Give each role one mechanical effect that allies actually feel:
  - forager: shares food to the lowest-hunger member (typed `ally-fed`, so sharing becomes measurable; today it can't be counted);
  - guard: posts the night watch, lowering ambush chance;
  - medic: triage;
  - scout: marks zones.

  Report per-role effect counts.
- **R3: reputation propagation.** Only 15.9% of kills are by ex-allies, and betrayal knowledge is local (`betrayedBy` plus witnesses). Spread "known betrayer" through `rumours.ts` with credibility weights (`credibilityWeight`, relationships.ts:111). Recruitment then reads a public reputation (`driftReputation` exists, :727), and repeat betrayers become unrecruitable outside the endgame.
- **R4: secret alliances.** A pair in different groups with regard of at least 60 and a shared enemy forms a hidden `secretPact`: they don't attack each other in group fights and they leak camp positions. It is revealed on a witnessed meeting, which triggers an expulsion hearing (`breachesBy` exists). It uses the `displayedRegard` split the romance layer already has.
- **R5: negotiation instead of a pure roll.** `parley.ts` and `blocTreaty.ts` produce 279 truces and 249 treaties, which mostly end as `truce-outlived` (626, the most repeated line in the game). Add terms, such as zone split, cache tribute or a non-aggression window. Breaking a term is a typed breach with fallout. Add 6+ variants of `truce-outlived`, keyed by how it ended.
- **R6: asymmetric bonds as a mechanic.** Only 0.4% of pairs are opposite-signed. Seed one unrequited edge per Games (existing `sincere`/`displayedRegard`). The unrequited party guards and shares, the other exploits, and a jealousy trigger feeds `triangles.ts`.
- **R7: positive saturation.** Soften the +100 cap (1.9% of edges sit at exactly +100, and the top bin outweighs ±60/±80) with diminishing returns above 70, e.g. `delta *= (100-v)/30`, so "would die for you" stays rare and meaningful. Keep the negative side as is.
- **R8: grudges inherited across seasons, per person.** `season/carry.ts:67-75` carries district-level rivalries only. Carry named grudges too: a victor's killer's district mentor, a betrayed tribute's district partner next year (`veterans.ts`/`mentors.ts`). Seed a −30 edge and a `district-bonds`-style reaping line ("their sister died to this district's knife").
- **R9: district-partner endgame choice.** `partner-standoff` (23/200) is only a line. Give it a resolution: a joint refusal (berries-style, gated on mutual regard of 80 or more and a gamemaker rule), a duel, or one walks away. Log each as its own type and add an achievement.
- **R10: line variety for single-template beats.** `betrayal-warning`, `vengeance-cooled`, `ward-bond`, `alliance-feud` and `obligation-made` each have one template, firing 65–277 times per 200 runs. Add 4–6 variants each, keyed to archetype or motive.
- **R11: an oath with a plan.** See RB2. Replace forced `Aggressive` with a stalk-and-wait objective, and add a `vengeance-paid` beat for solo payers.
- **R12: guards to add to `test:audit13-relations`.**
  - slow-burn ≥ 0.15/Games;
  - solo oath paid ≥ 10% of sworn;
  - warnings resolved (paid or stood down) = 100%;
  - no truth-below-2 record and no `memberIds` ≠ truth after any step;
  - wards estranged ≤ 5% of ward-cycles.

Harness files (scratchpad): `rel14.ts`, `an.ts`, `inv2.ts`, `inv3.ts`, `one.ts`; outputs `rel14.out`, `rel14b.out`.

---

## 6. Arenas, deaths and events


Scope: arena robustness and complexity after the AUDIT-13 implementation (`arenaDynamics.ts`: zone states, weather chains, night rules, day-8 finale, haunted sites; `universal13.ts`, `group8.ts`, `group9.ts`: D1–D76 and V1–V76). All numbers below come from scratch harnesses (`scratchpad/m.ts`, `scratchpad/r.ts`), which drive `Simulator` the same way `scripts/check-arena-deathmix.ts` does. Nothing in `src/` or `scripts/` was modified. Each new death and event below was checked by grep against `AUDIT*.md`, `src/data/arenaEvents/*`, `arenaFlavor*.ts`, `mutts*.ts`, `proceduralBiomeEvents.ts` and `arenaSignature.ts`. Where a term already existed (leech, quicksand, sleepwalk, crevasse, cornice, moulin, snow bridge, waterspout, lahar, stonefish, rogue wave, stampede, wasp, hornet, lightning, CO in a shelter, salt water), it was dropped or given a different mechanism.

#### Evidence

| Metric | Source | n | Result |
|---|---|---|---|
| Per-arena death mix | `m.ts`, 6 seeds × 55 hand-made arenas | 7,578 deaths | Tribute share 53–78%. Signature share of non-tribute deaths 0–35%. Distinct non-tribute cause shapes 24–45. All 598 zones were visited except 2 |
| Line repetition (names and numbers stripped) | `r.ts`, 8 seeds × 9 thin arenas | 72 runs | Unique-line ratio 0.70–0.73. 270–345 lines per arena appear in at least 75% of runs |
| Residual `hazard` code | both harnesses | – | Still the final `causeCode` in vault (4), warren (6), islands (8), ashgrove (9), burnscar, kiln, saltworks, tidewrack and procedural |
| Zone-state end snapshot | `m.ts` | 330 runs | `burning` ≈0 at game end everywhere. `flooded` is 0–3 even in water arenas (tidewrack 1, floe 0, reef 0, seapeaks 0) |

### Arenas: bugs, robustness and complexity

#### Measured table (6 seeds each; "sig" = `lastDamage.signature` share of non-tribute deaths; "shapes" = distinct non-tribute causes, with numbers normalised)

| Arena | Trib % | Sig % | Shapes | Avg days | Top non-tribute codes |
|---|---|---|---|---|---|
| tidewrack | **78** | 6 | 26 | 11.7 | collapse 5, bleeding 4, drowning 4 |
| thresher | **78** | 10 | 26 | 9.7 | fall 6, burns 4, bleeding 4 |
| acousticforest | **73** | 11 | 28 | 12.2 | bleeding 8, collapse 7, dehydration 6 |
| saltworks | **73** | 5 | **24** | 10.7 | collapse 7, bleeding 6, mutt 6 |
| vintage | **73** | 5 | 25 | 12.3 | hypothermia 5, starvation 5 |
| kiln | 71 | 3 | 26 | 9.5 | burns 13, mutt 9 |
| ashgrove | 71 | 20 | 28 | 11.7 | **hazard 9**, burns 8 |
| floe | 70 | 22 | **24** | 9.7 | hypothermia 15, exhaustion 8 |
| vault | 70 | **2** | 28 | 12.0 | poison 7, infection 6, **hazard 4** |
| concrete | 70 | 10 | 33 | 10.8 | burns 7, bleeding 5 |
| wardblock | 67 | **2** | 30 | 10.3 | dehydration 7, bleeding 6 |
| canopy | 64 | **2** | 29 | 12.7 | bleeding 13, fall 7 |
| seapeaks | 63 | **0** | 31 | 9.0 | hypothermia 11, fall 9, border 8 |
| burnscar | 65 | **0** | 36 | 10.7 | burns 10, border 8 |
| undercroft | 63 | **0** | 30 | 10.3 | bleeding 10, **border 10**, mutt 8 |
| malthouse | 64 | 6 | 26 | 9.3 | **burns 24**, fall 6 |
| glasshouse | 64 | 6 | 30 | 9.7 | mutt 16, collapse 8 |
| tempest | 57 | 12 | 45 | 11.2 | **border 13**, drowning 10 |
| terraces | 56 | 7 | 40 | 10.7 | **border 13**, fall 8 |
| labyrinth | 64 | 35 | 27 | 11.2 | starvation 11, collapse 7 |
| carnival | 57 | 15 | 43 | **17.2** | border 8, burns 6 |
| magmatube | 53 | 12 | 39 | 8.7 | burns 19, fall 17 |
| redcathedral | 62 | 17 | 29 | 11.2 | fall 17, burns 17 |

The other 32 arenas sit at tribute 56–69%, sig 4–22% and 28–39 shapes. The full dump is in `scratchpad/m.out`.

#### Findings

**W1 (P2, Confirmed): five arenas are above the 72% tribute-share ceiling.** tidewrack and thresher are at 78%, and acousticforest, saltworks and vintage at 73%. AUDIT-13 fixed glasshouse and gallery, but tidewrack and thresher got worse (AUDIT-13 did not list them). These are the same arenas with the fewest cause shapes, which fits: when arena events rarely kill, tributes do most of the killing. Fix: give each of these five arenas two of the arena-specific deaths below at a raised `arenaWeight`, and add them to the guarded set in `check-arena-deathmix`. That test passes today only because of the `+0.5` slack and the `REPORT_ONLY` path. Run it without `REPORT_ONLY` in CI.

**W2 (P2, Confirmed): signature share is still 0–2% in six arenas.** seapeaks, burnscar and undercroft are at 0%, and vault, wardblock and canopy at 2%. AUDIT-13 W4 proposed a 5% floor on `lastDamage.signature`, but the guard still reads `diedOfArena`. The floor was never enforced on the field the fix named. Fix: add `sigMin: 0.05` to `DEATH_MIX_BAND`, computed from `lastDamage.signature`, and tag the arena mechanic events in those six arenas (seapeaks tide and ice chimney, burnscar Standing Dead and seed-shrapnel, undercroft Third Rail) `signature: true`. A grep finds 0 `signature: true` in `src/data/arenaEvents/*.ts`, so the flag is only set in engine code.

**W3 (P2, Confirmed): the seed-shrapnel death leaks the sub-zone label and bypasses the hazard refinement.** At `src/engine/arenaSignature.ts:1025/1029` it renders "Caught in the seed-shrapnel over The Cornucopia (The Ash Clearing)" (2 of 8 burnscar runs), with `code: 'hazard'`. This is the AUDIT-13 W1 bug in a second code path. `applyDamage` does not route through `combat.ts:323` `refineHazardCode`, so the death keeps `hazard`. Fix: use the zone display name. Call `refineHazardCode` inside `applyDamage`/`checkDeath` instead of combat only, and add a check that fails on any `(` in `causeOfDeath`.

**W4 (P2, Confirmed): `hazard` is still a final cause code.** It appears in 9+ arenas (ashgrove 9, islands 8, warren 6, vault 4, kiln "Stuck in the flue", saltworks "Taken by the pumps", tidewrack "Lost a hand on Gull Rock"). The procedural fallback at `arenaSignature.ts:1835` also produces "Caught by the arena in <zone>". The CHANGELOG says 523 → 337 distinct causes were re-coded, but the catch-all survives on every path that does not go through combat. Fix: the same single choke point as W3, plus a `check-cause-codes` assertion that `hazard` is below 1% of deaths per arena. Suggested mappings: flue to asphyxiation, pumps to machinery, Gull Rock to crush.

**W5 (P2, Confirmed): the border is the top non-tribute killer in tempest (13), terraces (13), undercroft (10), warren (9) and quarry (9).** That is 2.2 border deaths per Games against a cap of about 1.5. Since AUDIT-13 set `convergeExtraZonesPerCycle` to 0 and made closures permanent, the border now finishes off tributes the arena should have been killing. Fix: when the per-arena border count reaches the cap, turn the next closure into the arena's signature push (flood, fire or collapse) and skip the plain border kill.

**W6 (P3, Confirmed): water arenas almost never end with flooded zones.** flooded counts at game end: tidewrack 1, floe 0, reef 0, seapeaks 0, karst 1. `burning` is about 0 everywhere, because it decays to ash within a cycle. The W11 state machine exists, but its trigger table ignores the arena's element, so tidal arenas get ruined/damaged just like cities do. Fix: seed state transitions from the arena's element tag (tidal → flooded/drained on a 2-cycle tide clock; fire → burning lasts ≥2 cycles), and show the tide clock in the zone chip.

**W7 (P3, Confirmed): about 300 lines per arena repeat in at least 75% of runs,** with a unique-line ratio of about 0.71 after names are stripped. The biggest sources are fixed-beat systems (arena briefing, arc-stage announcements, night-rule announcements, finale mutation text), each of which has one line per arena. Fix: 3 variants per arc and night-rule line, and suppress the second announcement of the same night rule within 3 nights.

**W8 (P3, Confirmed): two zones were never visited.** One culdesac zone and one cinderpeak zone went unvisited in 6 runs each. Every other arena covered all its zones. Fix: a low-weight "lure" event (an airdrop or a sound) targeting the least-visited zone after day 5.

**W9 (P3, Confirmed): carnival Games average 17.2 days against 8–13 elsewhere.** Carnival also has the highest cause variety (43 shapes). The length comes from low kill pressure in the late game: once the rides wake at night, they injure but rarely finish anyone. Fix: finale mutation on day 10 in carnival (not day 8+ with low weight), for example "the whole midway powers up at once".

**W10 (P3, Plausible): the procedural arena has few distinctive causes.** In procedural runs, 2 of 8 had generic "Caught by the arena in X" or "Caught by The Boreal Preserve as Rapids Chute closed". The biome→mechanic table from AUDIT-13 W6 gives one signature death per biome, but its wording falls back to the generic string when the biome has no authored cause. Fix: authored cause strings for all 162 procedural biome events (a check that no procedural death string starts with "Caught by the arena").

**W11 (P3, Plausible): malthouse is a one-note arena.** Burns are 24 of its about 50 non-tribute deaths (48%), and it has only 26 shapes. Fix: the malthouse deaths below (CO2 in the fermenter, silo engulfment, spirit-store flash) push that share toward 25%.

#### Deeper mechanics (not already in `arenaDynamics.ts`)

| ID | Mechanic | Summary |
|---|---|---|
| W12 | **Interactive terrain** | A tribute can act on a zone: dam the irrigation channel, fell a snag across a gully, cut a rope bridge, open a sluice. The action sets the zone's state for everyone else, and whoever caused it is credited as a "terrain kill" in the chronicle (new `killerVia: 'terrain'`) |
| W13 | **Gamemaker personalities** | 5 temperaments on `gamesProfile`: *Showman* (set pieces at dusk), *Accountant* (targets the zone with the most survivors), *Sadist* (heals and then hurts), *Naturalist* (weather only), *Absent* (half the event rate, but a finale at double strength). Each has its own announcement voice and changes event weights |
| W14 | **Multi-stage set pieces** | 3-beat events across cycles with a warning, an escalation and a resolution (the dam cracks, the dam leaks, the dam breaks). Tributes who react to beat 1 get a dodge bonus on beat 3. Stored as `pendingSetPiece` on state |
| W15 | **Arena learns** | Every repeat death by one mechanic lowers the next dodge chance in that zone ("the arena remembers what worked"). Every survived event raises tributes' `arenaSense` for that mechanic type |
| W16 | **Resource depletion** | Per-zone forage and water stock that is used up by visitors and refills on the arena's clock. This creates real competition over the last spring |
| W17 | **Sound map** | Loud actions (fights, cannons, a mutt kill) raise a zone's noise, which draws mutts and hunters for 1 cycle. Hiding in a loud zone is penalised |
| W18 | **Terrain scars across the season** | Extends AUDIT-13 W16: ruined zones persist into the next Games in a season with a new flavour name ("The Broken Pan, where the District 4 girl fell") |
| W19 | **Sponsor-visible forecast** | The weather-chain next step is shown to the player one cycle early for a price. The player can buy a warning, which gives the tribute a dodge bonus |

### More ways to die

Cause codes are the existing set plus the AUDIT-13 codes (crush, impact, electrocution, sound, animal, exposure-pressure). Trigger conditions use existing state names where they exist.

#### Universal deaths (D1–D30)

| ID | id | Code | Trigger | Sample |
|---|---|---|---|---|
| D1 | u-a14-d1-hail-open-ground | impact | storm weather step, zone concealment low, no shelter item | Hail the size of plums finds Mara on open ground, and there is nothing to get under. |
| D2 | u-a14-d2-infected-blister | sepsis | 3+ days travel, `exhaustion` high, no medicine | The blister on Tobin's heel went black on day four, and he kept walking on it. |
| D3 | u-a14-d3-bad-tin | poison | ate a Cornucopia ration after day 6 | The tin Lark opens has a bulged lid. She is hungry enough not to notice. |
| D4 | u-a14-d4-hidden-drop-night | fall | night, zone has a drop, stance Moving | Ansel steps off a ledge in the dark that he had walked past twice by day. |
| D5 | u-a14-d5-fishhook-hand | infection | fishing action, no clean water | A barbed hook goes through Nell's palm. The wound never closes. |
| D6 | u-a14-d6-panic-swim-cramp | drowning | fleeing into water, `exhaustion` > 60 | Cato makes it halfway across before his leg locks, and the rest of him follows it down. |
| D7 | u-a14-d7-infected-tooth | sepsis | lost a fight to the face, 4+ days later | A broken tooth from day two rots in Wren's jaw until the fever carries her off. |
| D8 | u-a14-d8-rockfall-rain | crush | rain chain step, zone with slopes | Loose stone comes down after the rain, and Rue is sitting under it. |
| D9 | u-a14-d9-heart-at-cannon | shock | sanity < 20, ally's cannon this cycle | Jory hears the cannon, knows whose it is, and sits down and does not get up. |
| D10 | u-a14-d10-bad-water-purify | infection | drank unpurified water 2 cycles running | Pell skipped boiling the water once, and then again. |
| D11 | u-a14-d11-burning-branch-fall | burns | wildfire nearby, sleeping in trees | A burning branch drops into Ivy's sleeping perch. |
| D12 | u-a14-d12-rope-burn-grip | fall | climbing rope, hand wound | Dell's torn hand opens on the rope, and he lets go. |
| D13 | u-a14-d13-sunburn-fever | heatstroke | 3 clear days, no cover item | Three days of full sun blister Lyra's skin, and the fever finishes it. |
| D14 | u-a14-d14-leg-in-burrow | bleeding | running, open ground | Faye's foot goes into a burrow at full sprint, and the bone comes out through the shin. |
| D15 | u-a14-d15-rabbit-poison-snare | poison | shared snare with a Hunter ally who baited it | The rabbit in Brin's snare had eaten the nightlock first. |
| D16 | u-a14-d16-choking-on-dried-meat | asphyxiation | alone, eating fast after starvation state | Oren wolfs the dried meat alone, with no one to hit his back. |
| D17 | u-a14-d17-dog-pack-wild | animal | not mutts; wild dogs on day 5+ | A pack of ordinary starving dogs brings Juno down. |
| D18 | u-a14-d18-bone-splinter-lung | bleeding | fall survived with a rib injury, 2 cycles later | Teo's cracked rib from the fall moves the wrong way when he coughs. |
| D19 | u-a14-d19-trip-onto-blade | self-inflicted | running with a drawn knife, night | Sela trips in the dark holding her own knife. |
| D20 | u-a14-d20-ally-mistaken-night | tribute | allied, night, sanity < 40 for the killer | Kit wakes to someone moving at the edge of camp and throws. It is Fen, back from the stream. |
| D21 | u-a14-d21-fever-in-rain | hypothermia | infection plus rain chain | Rain on top of the fever turns Maisie cold, and she never warms up. |
| D22 | u-a14-d22-dead-drop-weight | crush | stacked a cache under stones | The rock pile Evan built over his cache shifts as he reaches under. |
| D23 | u-a14-d23-anaphylaxis-sponsor | poison | sponsor gift food, allergy quirk | The sponsor's honey cake closes Tam's throat. |
| D24 | u-a14-d24-eye-wound-blind-walk | exposure | eye wound, walks blind into border zone | Blind in the wounded eye, Rhea walks out of the arena's edge without knowing it. |
| D25 | u-a14-d25-exploding-fire-stone | burns | lit fire on river stones | The wet stone in Hale's fire ring bursts like a grenade. |
| D26 | u-a14-d26-parachute-cord-strangle | asphyxiation | reaching a gift in a tree | Pia's gift parachute tangles around her neck when the branch gives. |
| D27 | u-a14-d27-kill-weight-exhaustion | exhaustion | carried a wounded ally 2+ cycles | Bram carried Jessa for two days, and set her down alive. |
| D28 | u-a14-d28-grief-walk | exposure | district partner died, sanity < 15, leaves cover | After the cannon, Aria walks into the open and stays there all night. |
| D29 | u-a14-d29-trophy-infection | infection | Careers, took a trophy from a corpse | The token Cass pried off the body brings the dead boy's rot with it. |
| D30 | u-a14-d30-gm-marked-signal-flare | gamemaker | lit a signal fire after dark, day 6+ | Lio's fire is the only light in the arena. The Gamemakers answer it. |

#### Arena-specific deaths (A1–A42; thinnest arenas by shapes, sig share and tribute share)

| ID | Arena | id | Code | Trigger | Sample |
|---|---|---|---|---|---|
| A1 | tidewrack | tw-a14-mussel-cut-tide | drowning | Mussel Flats, feet cut, tide rising | The mussels slice Mira's feet and she cannot run the last hundred yards before the tide. |
| A2 | tidewrack | tw-a14-wreck-shift | crush | The Wreck Line, storm step | The wreck on the Wreck Line rolls in the swell, with Joss inside the hull. |
| A3 | tidewrack | tw-a14-boathouse-winch | machinery | Boathouse Row, night | A boathouse winch runs on its own and drags Ada down the slip. |
| A4 | thresher | th-a14-coolant-race-scald | burns | Coolant Race, after a machinery event | The Coolant Race runs boiling after the shutdown, and Rook is wading it. |
| A5 | thresher | th-a14-bone-hopper-bury | asphyxiation | The Bone Hoppers, hiding stance | Nico hid in the hopper, and the hopper filled. |
| A6 | thresher | th-a14-scale-house-weigh | gamemaker | Scale House, heaviest tribute present | The Scale House weighs everyone who enters. Tobias is heaviest, and the floor opens. |
| A7 | saltworks | sw-a14-brine-well-descent | drowning | The Brine Well, climbing down for water | The brine is too dense to swim in and too thick to climb out of. It keeps Lena. |
| A8 | saltworks | sw-a14-stack-avalanche | crush | The Stack Yard, rain chain | The wet salt stacks slump all at once over Ben. |
| A9 | saltworks | sw-a14-salt-eyes-walkoff | fall | Crust Ridge, glare plus no eye cover | Salt-blind, Iris walks off Crust Ridge into the pan. |
| A10 | kiln | kl-a14-slip-cellar-suck | asphyxiation | The Slip Cellar, flooded state | The liquid clay in the Slip Cellar holds Dov at the waist, then the chest. |
| A11 | kiln | kl-a14-cooling-rack-shatter | bleeding | The Cooling Racks, cold snap step | The pots on the Cooling Racks crack in the cold and shower Mae with shards. |
| A12 | kiln | kl-a14-glaze-lead | poison | Glaze Pits, drank from pit water | The water pooled in the Glaze Pits is sweet. That is the lead. |
| A13 | vintage | vi-a14-press-house | machinery | The Press House, hiding stance | The wine press comes down on the loft where Anya is sleeping. |
| A14 | vintage | vi-a14-bell-tower-swing | impact | Bell Tower, noon | The noon bell swings with Paz on the beam beside it. |
| A15 | vintage | vi-a14-cellar-must-gas | asphyxiation | The Wine Cellar, fermenting season (day 4+) | The Wine Cellar is full of fermenting must, and the air in it is no longer air. Remy sleeps there. |
| A16 | floe | fl-a14-seal-colony-bull | animal | The Seal Colony, carrying fish | A bull seal the weight of a cart takes Oskar for a rival. |
| A17 | floe | fl-a14-frozen-wreck-hold | hypothermia | The Frozen Wreck, sheltering night | The hold of the Frozen Wreck is out of the wind and colder than the wind. Sven sleeps there. |
| A18 | floe | fl-a14-grease-ice-swim | drowning | The Grease Ice, fleeing | Grease ice looks like water and is not. Ilse cannot swim through it. |
| A19 | malthouse | mh-a14-fermenter-co2 | asphyxiation | Fermentation floor, leaning into a vat | Hugo leans over the vat to fill his canteen and breathes the fermenter. |
| A20 | malthouse | mh-a14-silo-engulf | asphyxiation | The Grain Silos, climbing for the view | The grain gives under Dara like water, and closes over her head like sand. |
| A21 | malthouse | mh-a14-spirit-flash | burns | The Spirit Store, any fire | The Spirit Store only needed a spark. Jem brought a torch. |
| A22 | glasshouse | gh-a14-pane-drop | impact | The Shattered Atrium, wind step | A single loose pane lets go from forty feet up. It is enough for Clio. |
| A23 | glasshouse | gh-a14-aquatic-intake | drowning | The Aquatic Wing, swimming | The pond intake in the Aquatic Wing pulls Leo against the grate. |
| A24 | glasshouse | gh-a14-boiler-steam | burns | The Boiler House, night | The boiler vents at midnight into the corridor where Bea is hiding. |
| A25 | wardblock | wb-a14-cell-lock | dehydration | Cell Block A/B/C, hiding, gamemaker lock event | The cell door Pip closed for safety will not open again. |
| A26 | wardblock | wb-a14-laundry-mangle | machinery | The Laundry, fight in zone | The mangle in the laundry takes Dex's sleeve and then Dex. |
| A27 | wardblock | wb-a14-tower-searchlight | gamemaker | The Guard Tower lights up a runner in The Yard | The searchlight finds Rosa in the Yard, and so does everyone else. |
| A28 | undercroft | uc-a14-third-rail | electrocution | The Third Rail, crossing tracks | Colm steps across the tracks and his heel touches the third rail. |
| A29 | undercroft | uc-a14-ghost-train | impact | Track Tunnel North/South, night rule | A train with no driver and no lights comes down the North tunnel. Tess hears it too late. |
| A30 | undercroft | uc-a14-turnstile-crush | crush | The Turnstiles, crowd (3+ tributes) | Three people try the turnstiles at once, and Abel is the one in the middle. |
| A31 | seapeaks | sp-a14-ice-chimney-plug | crush | The Ice Chimney, thaw step | The ice plug in the chimney lets go above Kai. |
| A32 | seapeaks | sp-a14-sea-cave-tide | drowning | The Sea Cave, sleeping | Mina sleeps in the Sea Cave and wakes with the tide at the roof. |
| A33 | seapeaks | sp-a14-kelp-tangle | drowning | Kelp Shallows, swimming | The kelp wraps Orrin's ankles in the swell. |
| A34 | burnscar | bs-a14-standing-dead-fall | crush | The Standing Dead, wind step | A burnt snag the height of a house comes down across Ezra. |
| A35 | burnscar | bs-a14-stump-hole | burns | The Old Burn Line, walking | Lise steps into a burnt-out stump hole, still full of embers at the bottom. |
| A36 | burnscar | bs-a14-erosion-gully-slide | crush | Erosion Gully, rain step | The bare slope with no roots left slides into Erosion Gully on top of Ned. |
| A37 | vault | va-a14-turbine-hall | machinery | The Turbine Hall, finale stage | The turbines spin up for the finale while Nadia is crossing the catwalk. |
| A38 | vault | va-a14-seed-vault-cold | hypothermia | The Seed Vault, hiding | The Seed Vault is kept at minus eighteen. Theo meant to stay an hour. |
| A39 | vault | va-a14-reactor-level-sickness | exposure-pressure | Reactor Level, 2+ cycles in zone | Two days on the Reactor Level and Willa's hair is coming out in her hands. |
| A40 | canopy | cn-a14-strangler-fig | asphyxiation | The Strangler Fig, sleeping in it | The fig's roots have been growing around Asa's hammock all night. |
| A41 | canopy | cn-a14-epiphyte-shelf-tip | fall | The Epiphyte Shelf, 2+ tributes | The shelf of orchids and moss was holding one person. Now it is holding Fern and Rudi. |
| A42 | canopy | cn-a14-cistern-hollow | drowning | Cistern Hollows, injured | Uri crawls into a tree hollow to hide. It is full of rainwater to the brim. |

### More events

#### Universal events (V1–V30; non-lethal, multi-tribute or set pieces)

| ID | id | Type | Trigger | Sample |
|---|---|---|---|---|
| V1 | u-a14-v1-truce-at-water | multi | 2+ hostile tributes, one water source (depletion W16) | Mara and Joss drink from opposite ends of the pool, and neither one reaches for a knife. |
| V2 | u-a14-v2-teach-snare | alliance | Hunter plus non-Hunter ally | Tobin shows Lark how to set the snare so the loop closes. |
| V3 | u-a14-v3-mock-grave | sanity | fallen ally's body found | Ansel stacks stones over the body and scratches the district number on the top one. |
| V4 | u-a14-v4-decoy-camp | stealth | Strategist, day 3+ | Nell builds a second fire she will never sit at. |
| V5 | u-a14-v5-sponsor-bidding-war | gift | two sponsors fund one tribute | Two parachutes land on Cato's camp one after the other, and each has a note in a different hand. |
| V6 | u-a14-v6-sing-at-night | morale | allied, night, sanity < 40 | Wren sings the district's harvest song under her breath, and Rue joins in on the second verse. |
| V7 | u-a14-v7-dead-tribute-map | loot | loot a body | Pell finds a map drawn on the dead boy's sleeve, with three water marks on it. |
| V8 | u-a14-v8-fake-cannon | gamemaker | Showman personality | A cannon fires, and in the morning the sky shows no new face. |
| V9 | u-a14-v9-swap-weapons | alliance | 2 allies with mismatched skills | Ivy trades her spear for Dell's knife, and both of them hold the new thing better. |
| V10 | u-a14-v10-wounded-enemy-spared | mercy | enemy at low hp, attacker sanity > 60 | Lyra has Faye on the ground and walks away. |
| V11 | u-a14-v11-shared-sky-watch | multi | 2+ tributes in view of each other at dusk | Across the valley, Brin sees another fire. Neither one puts theirs out. |
| V12 | u-a14-v12-recorded-last-words | gamemaker | 5 remain | The sky plays each tribute's interview answer, and Oren hears his own voice say he will come home. |
| V13 | u-a14-v13-honey-find | forage | forest-like zone, day 4+ | Juno smokes a hive with wet leaves and comes away with a comb, and only three stings. |
| V14 | u-a14-v14-mapping-stars | skill | night, clear | Teo works out north from the stars, and the arena suddenly has a shape. |
| V15 | u-a14-v15-false-ally-overheard | betrayal setup | alliance of 3+ | Sela hears Kit and Fen whispering about when. |
| V15b | u-a14-v15b-confront | follow-up to V15 | V15 fired previous cycle | Sela asks Kit, straight out, and Kit does not answer fast enough. |
| V16 | u-a14-v16-cannon-count-error | sanity | sanity < 30 | Maisie counts the cannons twice and gets two different numbers. |
| V17 | u-a14-v17-bury-token | ritual | alone, own district token | Evan buries his token under the tree he means to die under, so it goes home by another route. |
| V18 | u-a14-v18-tracking-blood | hunt | wounded tribute moved zones | Tam follows the blood drops for a mile, until they stop. |
| V19 | u-a14-v19-warm-body-share | alliance | cold night, allied | Rhea and Hale sleep back to back, and both are alive at dawn. |
| V20 | u-a14-v20-gm-reward-drama | gamemaker | first kill of the day on camera | A single silver parachute drops on the spot where Pia made the kill. |
| V21 | u-a14-v21-trade-at-border | multi | 2 strangers near border | Bram and Jessa trade a water skin for three matches without coming within a spear's length. |
| V22 | u-a14-v22-dream-of-home | sanity | sleep, sanity 20–50 | Aria dreams of the bakery and wakes up hungry and a little braver. |
| V23 | u-a14-v23-carrion-birds-mark | reveal | corpse unburied 1 cycle | The birds circling over the ravine tell Cass exactly where the body is, and so where the killer went. |
| V24 | u-a14-v24-sponsor-message-only | gift | cheapest tier | The parachute holds only a note: "Left." Lio goes left. |
| V25 | u-a14-v25-injury-splint | medicine | ally with a broken limb | Kai splints Mina's leg with two arrows and his belt. |
| V26 | u-a14-v26-career-hunt-party | multi set piece | Careers alive ≥3, day 3–6 | The Careers sweep the valley in a line, and Orrin lies in the reeds while they pass. |
| V27 | u-a14-v27-mutual-standoff | multi | 3 armed tributes meet | Ezra, Lise and Ned stand in a triangle with their blades up until the sun goes down. |
| V28 | u-a14-v28-lost-in-own-zone | sanity | fog chain | Nadia walks for an hour and comes back to her own camp. |
| V29 | u-a14-v29-gm-countdown | gamemaker set piece | Accountant personality, crowded zone | A voice counts down from sixty over the crowded zone. Theo does not wait to hear what comes at zero. |
| V30 | u-a14-v30-victor-voice | sponsor | season mode, a past victor is mentor | Willa's mentor's voice comes out of the parachute speaker: "Stay high tonight." |

#### Arena-specific events (V31–V72)

| ID | Arena | id | Type | Sample |
|---|---|---|---|---|
| V31 | tidewrack | tw-a14-v-low-low-tide | set piece | The lowest tide of the Games uncovers the Drowned Village. Mira walks its streets for an hour. |
| V32 | tidewrack | tw-a14-v-cockle-harvest | forage multi | Joss and Ada dig cockles side by side on the Cockle Beds, and neither of them looks up. |
| V33 | tidewrack | tw-a14-v-bottle-message | loot | A bottle on the Wreck Line holds a note from last year's Games. |
| V34 | thresher | th-a14-v-shift-whistle | set piece (3-beat) | The shift whistle blows once, twice, and on the third the whole floor starts moving. Rook is on the Gantry. |
| V35 | thresher | th-a14-v-foreman-desk | loot | Nico finds a floor plan in the Foreman's Gallery with the Underfloor Ducts marked. |
| V36 | thresher | th-a14-v-belt-ride | movement | Tobias rides the Packing Hall belt across the arena in ten minutes. |
| V37 | saltworks | sw-a14-v-pan-flood | terrain (W12) | Lena opens the sluice to Evaporation Pan Two, and the pan is a lake by dusk. |
| V38 | saltworks | sw-a14-v-salt-trade | multi | Ben trades a sack of clean salt from the Harvest Rows for Iris's spare knife. |
| V39 | saltworks | sw-a14-v-pump-house-restart | set piece | The Pump House coughs back to life at midnight, and every pan starts to fill. |
| V40 | kiln | kl-a14-v-firing-schedule | forecast | Dov reads the firing schedule chalked on Kilnhead and knows which chimney goes next. |
| V41 | kiln | kl-a14-v-warm-shards | shelter | Mae sleeps in the Shard Field on a bed of warm broken pots. |
| V42 | kiln | kl-a14-v-clay-armour | craft | Anya packs wet clay over her forearms, and it bakes hard in the sun. |
| V43 | vintage | vi-a14-v-harvest-festival | set piece | The Gamemakers light lanterns along Terrace Row Two for a harvest night. Paz and Remy share grapes under them. |
| V44 | vintage | vi-a14-v-barrel-rolling | terrain | Anya knocks the chocks out, and six barrels thunder down the Barrel Vault ramp. |
| V45 | vintage | vi-a14-v-chapel-bell | reveal | Someone rings the Old Chapel bell at midnight, and every tribute knows where they are. |
| V46 | floe | fl-a14-v-floe-drift | terrain | Overnight the Big Berg drifts two zones east, with Oskar asleep on it. |
| V47 | floe | fl-a14-v-seal-hunt | forage | Sven waits four hours over a breathing hole and comes back with a seal. |
| V48 | floe | fl-a14-v-wreck-stove | shelter | Ilse gets the Frozen Wreck's galley stove lit with a drawer's worth of charts. |
| V49 | malthouse | mh-a14-v-bottling-line-run | set piece | The Bottling Line starts up by itself. Hugo rides it past the Careers' camp. |
| V50 | malthouse | mh-a14-v-hop-yard-cover | stealth | Dara lies in the Hop Yard bines, and the smell covers her from the dogs. |
| V51 | malthouse | mh-a14-v-drunk-career | multi | Two Careers find the Spirit Store. Jem hears them singing at dusk and takes the long way round. |
| V52 | glasshouse | gh-a14-v-desert-wing-night | shelter | Clio sleeps in the Desert Wing because the sand stays warm. |
| V53 | glasshouse | gh-a14-v-misters | weather | The misting system comes on across the Tropical Wing, and Leo drinks from the nozzles. |
| V54 | glasshouse | gh-a14-v-orchid-vault-lock | set piece | The Orchid Vault locks for a day with Bea and a stranger inside. |
| V55 | wardblock | wb-a14-v-roll-call | gamemaker | The yard speakers call roll by district. Pip answers anyway. |
| V56 | wardblock | wb-a14-v-infirmary-stock | loot | Dex finds one sealed box of bandages left in the Infirmary. |
| V57 | wardblock | wb-a14-v-lockdown | set piece (3-beat) | The lockdown siren sounds, every cell door opens, and on the third blast they all close again. |
| V58 | undercroft | uc-a14-v-timetable | forecast | Colm finds a timetable in the Signal Room. The ghost train keeps it. |
| V59 | undercroft | uc-a14-v-depot-handcar | movement | Tess and Abel pump a handcar down the South tunnel. |
| V60 | undercroft | uc-a14-v-platform-echo | reveal (sound W17) | A shout on the Collapsed Platform carries down both tunnels. |
| V61 | seapeaks | sp-a14-v-low-tide-causeway | terrain | At low tide the causeway between the peaks comes up, and Kai crosses dry. |
| V62 | seapeaks | sp-a14-v-seabird-eggs | forage | Mina climbs the Second Peak's ledges for eggs. |
| V63 | seapeaks | sp-a14-v-summit-signal | set piece | Whoever reaches the Summit Col first sees every camp. Orrin gets there at dawn. |
| V64 | burnscar | bs-a14-v-fireweed-bloom | regrowth state | The Fireweed Slope comes out pink overnight, and the bees come with it. |
| V65 | burnscar | bs-a14-v-morels | forage | Ezra finds morels in the ash where the fire was hottest. |
| V66 | burnscar | bs-a14-v-seep-spring-fight | multi | Seep Spring runs one cup an hour. Lise and Ned take turns, watching each other. |
| V67 | vault | va-a14-v-hydroponics-harvest | forage | Nadia pulls lettuce from the Hydroponics Bay under blue grow-lights. |
| V68 | vault | va-a14-v-dormitory-bunks | shelter multi | Theo and Willa sleep in bunks three rooms apart in the Dormitory Block, and do not know it. |
| V69 | vault | va-a14-v-intercom | gamemaker | The Vault's intercom reads out the air-reserve percentage every hour. |
| V70 | canopy | cn-a14-v-bridge-cut | terrain (W12) | Asa cuts the rope bridge behind him, and the Careers are left on the other side. |
| V71 | canopy | cn-a14-v-orchid-nectar | forage | Fern drinks from the orchids on the Terraces. |
| V72 | canopy | cn-a14-v-crown-view | reveal | Rudi climbs to the Crown and sees the whole arena as a bowl. |

#### Suggested order

Start with W3 and W4, which share one code choke point. Then do W2 (the guard reading the right field) and W1 (tribute ceiling), using A1–A15 for the five arenas above the ceiling. After that, W12 interactive terrain and W13 Gamemaker personalities, because several V events (V8, V29, V37, V44, V70) depend on them.

---

## 7. Balance and new content


Scope: traits, archetypes, skills, quirks, stances, personas and districts. I did not touch `src/` or `scripts/`. The harness is in the scratchpad (`harness.ts`, `harness12.ts`, `harnessC.ts`, and the `an.py` reducer). Every rate below is a win rate per entrant with a Wilson 95% interval. "HI" and "LO" mean the interval excludes the field mean. Items already raised in AUDIT-13 A1–A27 are only re-measured here, never re-proposed. New IDs continue from **A28**.

#### Evidence

| # | run | n | result |
|---|---|---|---|
| E1 | `METRICS_RUNS=800 npx tsx scripts/metrics.ts` | 800 runs, 14,467 deaths | Exit 0, "All regression guards hold". Avg 10.1 d. Careers **48.2%** of victors [±3.4]; D4 **21.4%** (flagged FAIL-in-CI). Archetype spread 1.30× (guarded rows); whole-field 5.17× (not judgeable). Stitch-Fingered 0/129 is last. Rarest stance 1.1%. |
| E2 | `DIAGNOSE_RUNS=800 scripts/diagnose-archetypes.ts` | 800 | Worst: diplomat 2.82 [1.43–5.46], captor 2.95, zealot 2.97, herald 3.22, turncoat 3.23, lamplighter 3.33. Hermit company is 12.06 others and it is alone **6.6%** of cycles. Gambler dies without firing its signature 85.3% of the time, turncoat 83.9%. |
| E3 | `scripts/funnel.ts` | 120 | Signature fire rate: gambler 12.0%, warden-of-the-weak 12.9%, firekeeper 21.1%, forger 24.1%. Header says "funnel is inert: 30 seeds identical on/off". |
| E4 | `scripts/cohorts.ts` (bare) | — | Prints usage only; it needs arguments. |
| E5 | `cohorts.ts trait "Drowned Once"` | 198 pairs | Days +0.101 [−0.030, 0.232]; wins +0.005 [−0.005, 0.015]. Positive, not decisive. |
| E6 | `cohorts.ts archetype confessor penitent` | 200 pairs | Confessor→penitent: **+4.5 pp wins [1.0, 8.0]**, +0.71 d. Penitent→confessor: **−6.0 pp [−10.3, −1.7]**, −0.79 d. Causal and decisive. |
| E7 | harness H1: the metrics config mix (12 / 6 / 12+haz1.5 / 8 districts), seeds `a14-0..3999` | 4,000 runs, 76,436 entrants | Field 5.37%. Career 7.83% vs non-career 4.24%. Tables A28–A40. |
| E8 | harness H2: 12 districts with hazard 1.5 only | 1,000 | Career 4.38 [3.9–4.9] vs non-career 4.22 [3.9–4.5]. |
| E9 | harness H3: `DEFAULT_GAME_CONFIG` only (12 districts) | 800 | Career 4.42 [3.9–5.0] vs non-career 4.29 [4.0–4.6]. |
| E10 | harness H4: 6 districts only | 800 | Career **13.48 [12.5–14.5]** vs non-career **3.41 [2.9–4.0]**. Non-career horn deaths 55.6%. |
| E11 | H2+H3 pooled (12-district), archetype among non-Careers | 1,800 | Tables A31. |
| E12 | static grep: all 70 `AUDIT13_CONTENT` keys and every export in `audit13Content.ts`, `traitHooks.ts`, `archetypeHooks.ts` | — | 0 unread keys, 0 exports without callers. |

### Trait, archetype, skill, stance and district balance

#### Districts and Careers (the imbalance that is real)

- **A28 (Confirmed; the headline). The Career and D1/2/4 dominance in `metrics.ts` is a field-size artefact.** Per head, the Careers are balanced in the default game.

| config | Career win/head | non-Career | ratio | non-Career horn deaths |
|---|---|---|---|---|
| 12 districts (default, E9) | 4.42 [3.9–5.0] | 4.29 [4.0–4.6] | 1.03× | 40.3% |
| 12 districts, hazard 1.5 (E8) | 4.38 [3.9–4.9] | 4.22 [3.9–4.5] | 1.04× | 40.2% |
| 6 districts (E10) | 13.48 [12.5–14.5] | 3.41 [2.9–4.0] | **3.95×** | **55.6%** |
| mix, as metrics runs it (E7) | 7.83 [7.5–8.2] | 4.24 [4.1–4.4] | 1.85× | 43.1% |

In a 6-district field the three Career districts are half the cast (in an 8-district field, three-eighths), and they take the horn. D1/D2/D4 are also the only Career districts present in every config. So the "Careers 48.2%" and "D4 21.4%" guard lines mostly measure how the harness mixes configs.

Proposals:

1. In `scripts/metrics.ts`, change the Career guard to a per-head ratio (Career win/head ÷ non-Career win/head). Report it separately for 12 districts and for small fields.
2. Fix the small-field game itself. In small fields, scale the bloodbath's Career `hornCommitment` pressure by `min(1, careerShare/0.25)`, or give non-Careers a `scatter` plan bias there. The hook is the horn-plan picker (`gongDecision` / `hornPlan`). The 55.6% non-Career horn-death rate is the lever to move.

- **A29 (Confirmed, every config). D3, D5 and D6 are the weak districts.** Pooled 12-district figures (E11): D6 **2.78 [2.3–3.4]**, D3 **2.92 [2.4–3.5]**, D5 **3.36 [2.8–4.0]**, against D10 5.86 [5.1–6.7] and D12 5.42. D3 and D6 are also LO in the 6-district run (3.06, 2.94).

  Legacy tier does not explain it: D10 is "thin" and D12 is "forgotten", yet both are HI. The shared cause is the craft. D3, D5 and D6 are the three districts whose main trade is `tracking`. None of them has an `affinityClasses` entry or a `hungerResilience` value (`src/data/districts.ts` DISTRICT_CRAFT 3/5/6). Starting `tracking` wins 4.63 [4.2–5.1] (LO), `signalling` (D3's signature skill) 3.39 (LO) and `navigation` (D6's) 3.99 (LO). D10 was fixed the same way in AUDIT-10 §3.3 (a melee trade plus a melee affinity) and is now the top district.

  Proposals:
  - D3: `crafting: TRADE`, `affinityClasses: ['ranged']` (bolas and crossbow already there).
  - D5: `affinityClasses: ['ranged']`, `hungerResilience: 0.95`.
  - D6: `evasion` or `sprinting: TRADE_MINOR` (a transport yard knows how to run), `hungerResilience: 0.95`.
  - Re-measure against "all 12 districts inside [3.5, 6.0]" at 12 districts only.

- **A30 (Confirmed). Starting skill is a district proxy, not a skill measurement.** The "skill" table in E7 has `swimming` n=4,000, which is exactly D4's entrants. `signalling` and `navigation` behave the same way. Skill balance cannot be read from starting proficiencies. Use the matched-cohort tool (a `skill` mode does not exist yet; proposed as a harness addition, not an engine change).

#### Archetypes

- **A31 (Confirmed). With Careers excluded, at 12 districts (E11, n 335–1,580 per row), the archetype field is 4.29%.**

| archetype | win% [CI] | n | notes |
|---|---|---|---|
| lamplighter (new) | **7.08 [4.9–10.2] HI** | 367 | best non-Career row. Beacon's −30% hazard for the whole alliance. |
| penitent | 5.95 [4.5–7.8] HI | 807 | |
| strategist | 5.91 [4.7–7.4] HI | 1268 | |
| … field 4.29 | | | |
| duellist | 2.66 [1.6–4.3] | 564 | 50.7% horn deaths; targetDraw 3, endurance −1 |
| archivist | 2.61 [1.5–4.4] | 498 | |
| pilgrim (new) | 2.30 [1.2–4.5] | 348 | |
| showrunner | **1.94 [1.0–3.8] LO** | 412 | 46.1% horn deaths |
| healer-pacifist | **1.62 [0.7–3.5] LO** | 371 | sacrificial by design (A22) |

  In the full mix (E7, n 790–3,747), only confessor 3.44 [2.5–4.7], scholar 4.17 [3.4–5.2] and diplomat 4.18 [3.3–5.3] are LO. The whole-field spread is 7.63/3.44 = **2.2×**, which meets the 2.3× goal.

- **A32 (Confirmed, causal). Confessor loses 4.5–6 pp to penitent in matched cohorts (E6).** The two share charisma/willpower builds. Confessor's `stanceBias.Desperate 0.8` is the outlier (`archetypes.ts` confessor), and Desperate is the stance with the worst outcomes. Proposal: `Desperate 0.8 → 0.3` and add `Parleying 0.3`. This also feeds the 0.66% Parleying stance (A38).

- **A33 (Plausible). Duellist and showrunner are Career-carried.** Duellist is 6.37% overall but 2.66% as a non-Career, and showrunner 4.72% overall but 1.94%. Both pair a high `targetDraw` (3 and 1) with a horn-death rate near 50%. Proposals:
  - Duellist: `targetDraw 3 → 1.5` and `endurance −1 → 0`.
  - Showrunner: add `hornFight −0.15`, the same knob hermit, forger and pilgrim use.

- **A34 (Confirmed; AUDIT-13 A21 is half shipped).** Hermit's `stanceBias.Hiding 0.6` landed, but hermits are still alone only 6.6% of cycles (E2), with 12.06 others in their zone. The `isolate` objective was never added (`grep isolate src/engine` finds nothing relevant). Hermit sits at 4.26% overall and 3.78% as a non-Career. Proposal: stands as written in A21, and it remains the only way the Hiding stance (0.71%) grows.

#### Skipped AUDIT-13 items, re-measured (E7 unless noted)

| id | item | now | verdict |
|---|---|---|---|
| A2 | Knot-Tier trapSkill 0.08 | 5.85 [4.5–7.6] n855 | Neutral. The +forage part is still worth doing for identity. Power is not the problem, so it is optional. |
| A3 | Scar-Reader awareness 0.2 | 5.58 [3.9–7.8] n538 | Neutral. Keep it skipped on balance grounds. The `executeDrive` idea remains a design call. |
| A4 | Unremarkable targetDraw −15 | 5.62 [4.5–7.0] n1370. Horn deaths **21.9%** (field ~31%), 5.02 days | **The lever works.** It has the lowest horn share of any common trait. The probe AUDIT-13 asked for is answered: `targetDraw` is not dead at the horn. Close A4. |
| A9 | Paranoid | 6.16 [4.9–7.7] n1217 | It was 10.16% at n128; that was noise. **Do not ship.** |
| A10 | Stone-Faced | 4.78 [3.6–6.3] n942 | Noise. Do not ship. |
| A11 | Silver-Tongued | 5.34 [4.3–6.6] n1404 | Exactly the field rate. Do not ship. |
| A12 | Butcher meleePower 1.7→2.0 | **7.26 [5.6–9.3] HI** n785 | **Reverse sign; do not ship.** The n174 "last place" was noise. If anything, cut it to 1.5. |
| A17 | Gambler | 5.14 [3.8–6.8] n837; signature 15.9% (E1), 12.0% (E3) | Win rate is fine; the signature is rare. Better approach below (A35). |
| A19 | Scholar hornFight −0.15 | 4.17 [3.4–5.2] **LO** n1941; non-Career 3.04. Horn deaths only 30.5% | Its horn share is *below* the field, so hornFight is the wrong knob. Scholar kills 0.47, the lowest. Proposal: `targetPreference 'weakest'` should apply only to the downed or injured (the `scarReaderSees` predicate). Otherwise use `objectiveBias.stalk 0.25 → 0`. |
| A23 | Guardian strength 2→1 | 6.58 [5.1–8.4] n882; non-Career 4.48 | The n95 11.58% was noise. Do not ship. |
| A24 | Tracker targetDraw 1.5→0.75 | 5.32 [4.1–6.8]; non-Career 3.91 with horn deaths 47.6% | The win rate is fine. Ship only the `hornFight −0.1` half, and only if the horn share still matters to someone. |

- **A35 (A17 re-proposed; code).** Loosening `gamblerOddsMax` adds lopsided fatal fights, which is why it shortened runs. Make the wager a **bet on someone else's fight** instead. When two non-allied tributes fight in the gambler's zone (`resolveCombat` callers in `encounters.ts`), a gambler present who picks the winner (by the same `worth()` closure, `archetypeHooks.ts:1246`) sets `signatureFired`. If they picked the underdog and it won, they also get the parachute (`traitHooks.ts:521-523`). No extra deaths, so run length is untouched. Keep the existing self-wager as the rare high-roll.

#### Traits

- **A36 (Confirmed). The trait table is flat; stop tuning from it.** In E7 every trait has n ≥ 480. Only 14 of 198 are HI or LO at 95%, where about 10 would be expected by chance. The metrics bottom six at n≈100 (E1) all regress to the field:

| trait | E1 metrics (n≈100–160) | E7 harness (n≈480–800) |
|---|---|---|
| Stitch-Fingered | 0.00% n129 | 4.94 [3.4–7.1] n526 |
| Cold-Blooded | 0.94 | 4.79 [3.2–7.1] |
| Hangs Back | 0.99 | 6.58 [4.8–9.0] |
| Thin-Skinned | 0.99 | 6.05 [4.3–8.5] |
| Quiet Room | 1.26 | 4.27 [3.1–5.9] |
| Beast-Wise | 1.68 | 7.01 [5.4–9.1] |

  Proposal: `metrics.ts` should mark any trait row with n < 400 as "oversample before reading". The per-trait tables in AUDIT-12 and AUDIT-13 were mostly noise.

- **A37 (Plausible). Drowned Once is a flaw that helps.** It wins 7.38 [5.4–10.0] HI at n515, and the cohort (E5) is positive though not decisive. The −50 destination score on `water` terrain (`audit13Content.ts:176`, `drownedOnceRefusal`) keeps them off the zones where drowning and tide deaths happen. Proposal: charge a real cost:
  - `thirstDrain +0.3` while no adjacent zone is `water`;
  - or apply the refusal to *crossings only* (movement edges), not to standing in wetland.

- The other 15 AUDIT-13 traits are **all inside the field interval** (E7, n 497–559). Loud Heart 5.54, Bad Knee 6.11, Mud-Skinned 3.62 [2.3–5.7] (lowest), Bell-Voiced 4.54, Two-Faced 5.52, Kin-Seeker 4.61, Ash-Lunged 5.44, Tin Ear 4.71, Hunger-Sharp 5.85, Borrowed Luck 5.27, Bitter Root 4.83, Deadfall Mind 3.75 [2.4–5.7], Slow Healer 5.30, Keeps Watch Alone 5.19, Stitch-Fingered 4.94. None needs a change on power grounds. Mud-Skinned and Deadfall Mind trail on the point estimate because their hooks are conditional (wetland only; held ground with own traps). They are acceptable niche traits.

#### Skills, quirks, stances, personas

- **A38 (Confirmed). Two of the six AUDIT-13 skills are universal, so they have no identity.** Tributes who *gained* each skill (from level 0 to ≥ 1) during a run, E7:
  - `weathercraft`: 44,979 of 76,436 entrants (**59%**);
  - `teaching`: 39,448 (**52%**);
  - `resting`: 16,916 (22%);
  - `bartering` 2,056, `mimicry` 1,530, `angling` 1,470 (2–3%, gated as intended).

  Weathercraft trains on every weather change survived outdoors, and teaching trains through `watchTeacherLearns` on any ally level-up in the zone. Proposal:
  - weathercraft trains only on a weather *act* or an exposure roll that is actually made (`exposure.ts`);
  - `teachingWatchShare` → 0, so only a tribute who actually taught gains it (`audit13Content.ts:432`);
  - target ≤ 15% of entrants for any non-core skill.

- **A39 (Confirmed). Quirks are balance-neutral, as they should be.** 117 quirks at n 830–920: 2 are HI and 4 LO at 95%, about the 6 expected by chance. The new "licks the blade before a fight" is LO at 3.59 [2.6–5.0], but its `poisonResist −0.05` is too small to be causal. Treat it as chance; no action. The other 5 new quirks are neutral. "keeps the first thing they find" fires (`audit13Content.ts:61`).

- **A40 (Confirmed). Stances.** Per-cycle living-tribute share from the harness (E7): Evasive 21.8 / Aggressive 18.8 / Defensive 16.8 / Fortified 9.4 / Scavenging 6.6 / Shadowing 5.4 / Nursing 5.2 / Patrolling 3.4 / Desperate 3.0 / Baiting 2.8 / Hunting 1.6 / **Mourning 1.17 / Sheltering 0.96 / Tending 0.88 / Regrouping 0.73 / Hiding 0.71 / Parleying 0.66**. `metrics.ts` samples differently and has them at 1.1–1.8. Six stances sit under 1.2% on this sampler. The three new AUDIT-13 stances fire, but thinly.
  - Regrouping is the rarest new one. Its precondition needs a known alliance zone and a clear zone (`regroupingAvailable`).
  - Proposal: relax "clear zone" to "no hostile *armed* tribute", and let A32's confessor Parleying bias and A34's hermit isolate objective lift the other two.

- **A41 (Plausible). Personas: spread 1.45×, acceptable.** E7: The Star-Crossed Lover 6.24 HI, The Charming Flirt 6.12 HI, The Humble Underdog 5.95 HI; LO are The Homesick 4.30, The Mysterious Enigma 4.61 and The Professional 4.78. The warm personas (`WARM_PERSONAS`, `personas.ts:31`) with negative `PERSONA_THREAT` win; the cold ones lose. That is the intended trade. No change.

#### New-archetype signatures (do they fire?)

Signature fire rates are from E1; events per run and non-Career win rates are from E9 at 12 districts.

| archetype | signature fire | events/run | non-Career win | verdict |
|---|---|---|---|---|
| firekeeper | **19.0%** | 0.054 hearth-kept | 5.12 | Fires rarely: needs 3 fire nights *and* a camp fire. Proposal: `firekeeperNights 3 → 2`. |
| kingmaker | 55.5% | 0.159 | 3.23 | Fires, but the kingmaker gains nothing personally. Add a small share of the ward's sponsor gifts (the `crownShare` hook exists, `audit13Content.ts:85`; check its payout > 0). |
| ratcatcher | 59.0% | 0.144 | 4.71 | OK. |
| pilgrim | 31.9% | 0.084 | **2.30** | Weak. The reach objective pulls it across the map through hunters. Proposal: pick the landmark among zones ≤ 2 hops from the start. |
| mourner | 44.9% | 0.125 | **2.78** | Weak; horn deaths 42.3% and kills 0.22. Mourning 0.8 plus rival targeting means it stands still in a dangerous zone. Proposal: `stanceBias.Mourning 0.8 → 0.5`, `hornFight −0.1`. |
| lamplighter | 49.1% | 0.138 | **7.08 HI** | Strong. Proposal: `beaconCycles` −1, or restrict the hazard cut to allies in the zone. |

---

### New traits, skills, archetypes, quirks, stances, personas

Every name was checked case-insensitively against `*.md`, `src/data/*.ts` and `src/models/types.ts`: no hits, except where noted. `Lockjaw` was rejected because it appears in `arenaEvents/universal13.ts`. Each item names the file to hook into, its niche, and its counter. TraitMod keys are the ones already in `traits.ts:22-106`.

#### Traits (16)

| id | trait | mods | engine hook (file) | niche | counter |
|---|---|---|---|---|---|
| T1 | Horn-Shy | hornCommitment −0.4, retreat +0.03 | horn-plan picker (`phases/bloodbath`, `hornPlan`); forces `scatter` unless armed at the gong | lets outer-district tributes skip the 40–55% horn death (A28/A29) | starts with nothing; hungry by day 3 |
| T2 | Sore Loser | vengeanceEdge 0.8 vs whoever last wounded them | `wounds.ts` recordWound → temporary grudge | a fighter who comes back | Scar-Reader and Finishes It see the wound first |
| T3 | Pack Mule | capacity +2, fatigueDay +1 | `items.ts` capacity | quartermaster and forager support | slow; nightMovement −0.05 |
| T4 | Quick Study | proficiency training ×1.25 | `proficiency.ts` trainProficiency scale (next to `trainingShareScale`) | late-game scaler | reaping trainingScore −1 |
| T5 | Gallows Humor | sanityDrain −0.2, sponsorAppeal +0.3 | `survival.ts`; `sponsors.ts` | sanity sink for long runs | concealment −0.03 (laughs at the wrong time) |
| T6 | Magpie | scavenge +0.15, targetDraw +0.3 | `fieldcraft.ts` scavenge roll | shiny-item finder | draws richest-target hunters (`targetPreference 'richest'`) |
| T7 | Fever-Proof | infection chance ×0.6 | `infection.ts:97` beside `stitchedInfectionScale` | anti-infection (2.1% of deaths) | bleedResist −0.05 |
| T8 | Rearguard | defended +0.4 while retreating with an ally | `combat.ts` retreat branch | alliance tail | killed first in ambushes: ambush against them +0.05 |
| T9 | Cold Feet | betrayalResist −0.2, retreat +0.05 | `betrayal.ts` | defects before a losing final fight | allies distrust them: trustGain −0.2 |
| T10 | Late Bloomer | combatPower −0.5 on days 1–4, +0.6 from day 7 | `combat.ts` power sum | rewards surviving the early game | weak at the horn |
| T11 | Blood-Shy | killSanity −1.0 (large), aggressionScore −0.3 | `composure.ts` | anti-killer; pairs with Pacifist | needs allies to finish fights |
| T12 | Soft Step | nightMovement +0.1, noise −20% | `noise.ts` | night traveller, distinct from Silent Step (earned) | awarenessNight −0.2 |
| T13 | Iron Lungs | smoke/hazard damage ×0.7 (non-burn) | `audit13DamageScale` in `audit13Content.ts:231` | hazard-arena specialist; Ash-Lunged covers burns only | fatigueDay +0.5 |
| T14 | Sharp Elbows | scavenge +0.1 at the horn, combatPower +0.3 at the horn only | `phases/bloodbath` grab resolution | wins the grab, not the war | targetDraw +0.5 day 1 |
| T15 | Hand-Me-Down | starts with a district signature weapon (`craftOf(d).signatureWeapon`) | `generator.ts` loadout | armed outer-district start (A29 support) | sponsorTrust −0.5 (nothing to buy them) |
| T16 | Short Fuse | combatPower +0.4 once provoked (hit first), rapport −0.2 | `combat.ts` defender branch | counter-attacker, distinct from Counterpuncher (whose timing is proactive) | truces break more easily: `truces` expiry −1 |

#### Skills (8)

New `Proficiency` union members (`types.ts:343`) and trained via `trainProficiency`. Each targets ≤ 15% of entrants gaining it (see A38).

| id | skill | trains on | effect (file) | niche | counter |
|---|---|---|---|---|---|
| K1 | poisoncraft | preparing a poisoned item or a berry snare | poisoned-weapon hit adds `poison` tick (`combat.ts`); +5% per level | D8/D11 lethality without melee | Venom-Wise and poisonResist |
| K2 | feinting | winning a fight exchange without a kill | first exchange opponent defended −4% per level (`combat.ts`) | duellist and Career skill ceiling | vigilance / awareness |
| K3 | disarming | a disarm in a fight | chance to strip a weapon, +3% per level (`resolve.ts` already mentions disarming) | the unarmed answer to weapons | Grips Hard (wrestle) |
| K4 | shelterwright | building or using shelter | Sheltering threshold (`shelterSkill`, `audit13Content.ts:183`) and −4% exposure per level | makes Sheltering reachable (A40) | fire and smoke draw hunters (`hearthDraw`) |
| K5 | triage | treating a downed ally | `treat-downed` refusal (35% get through, E1) cut by 8% per level (`downed.ts`) | medic and martyr payoff | time cost: hoursLeft −2 |
| K6 | bracing | surviving a fall, collapse or hazard hit | fall and structural damage −5% per level (`hazardChain.ts`) | vertical and building arenas | none offensive; pure survival |
| K7 | scentcraft | crossing water or mud to break a trail | mutt and tracker pursuit −5% per level (`mutts.ts`, `targeting.ts`) | the anti-tracker, anti-mutt skill | swimming risk; thirst |
| K8 | caching | burying supplies (quirk "buries what they cannot carry" exists) | a hidden cache can't be stolen or looted; retrieved later (`items.ts`, `abandonedCamps.ts`) | long-game supply for hermit and forager | forgetting it: navigation check |

#### Archetypes (6)

| id | archetype | stats / biases | signature (file) | niche | counter |
|---|---|---|---|---|---|
| R1 | Cutpurse | agility 2, stealth 1; aggression −0.1; target `richest`; stance Shadowing 0.6 | *lift*: steals one item from a sleeping or distracted tribute in the zone without a fight (`archetypeHooks.ts` + `items.ts` transfer) | non-violent item economy | vigilance and Light Sleeper wake the victim → fight |
| R2 | Undertaker | willpower 2, intelligence 1; alliance 0.2 | *lastRites*: loots and buries a body (sanity +, sponsor +) and learns the killer (`memory.ts` witnessed) | turns deaths into information (feeds A28 vengeance) | spends a cycle in a zone where killing just happened |
| R3 | Poacher | stealth 2, agility 1; preferred Trapper, Houndsman | *snareHunt*: its trap catches a *tribute* (downs, not kills) (`fieldcraft.ts` traps) | the trap archetype that can win, unlike ratcatcher's food and mutts | Trapwise and trackers avoid it; `pestSweep` cannot clear it |
| R4 | Tinker | intelligence 2, endurance 1; preferred Rope-Handed, Mapmaker | *jury-rig*: repairs a broken weapon or turns junk into a crude weapon (`items.ts`, like `forgeWeapon`) | an armed D3/D5 answer (A29) | crude weapons break at 2× rate |
| R5 | Smuggler | charisma 1, agility 1, stealth 1; treachery 0.2 | *runGoods*: carries a parachute gift between two allies across zones and takes a cut (`parachutes.ts`, `obligations.ts`) | the courier's dark mirror | a robbed smuggler loses everything (targetDraw +1 while carrying) |
| R6 | Sentinel | willpower 1, endurance 2; alliance 0.4; stance Patrolling 0.6 | *holdTheLine*: while an ally sleeps in-zone, first ambush auto-fails once per night (`encounters.ts` rollAmbush + `audit13AmbushShift`) | an alliance night guard; lifts Patrolling | fatigueNight +2; an alone Sentinel has no signature |

(`sentinel` appears only as a name in `names.ts`. It is not an archetype ID, but rename it to `Nightwarden` if the collision matters.)

#### Quirks (8)

All are new labels, with modifiers in `QUIRK_MODS` (`quirks.ts:1113`).

| id | quirk | mods / hook | counter |
|---|---|---|---|
| Q1 | "counts arrows before sleeping" | rangedPower +0.05; ammo loss −1 per fight (`items.ts`) | fatigueNight +0.3 |
| Q2 | "never takes the path they came by" | awareness +0.1 on moves; movement cost +1 h (`actionBudget.ts`) | slower |
| Q3 | "sleeps under their pack" | capacity items can't be stolen asleep (links R1) | fatigueNight +0.3 |
| Q4 | "talks to the mutts" | muttDamage −0.05 | concealment −0.03 |
| Q5 | "eats the bitter leaves first" | poisonResist +0.05 | hungerDrain +0.2 |
| Q6 | "hides a blade in their boot" | 10% chance to be armed after being disarmed (`combat.ts`) | a search reveals it: loot +1 |
| Q7 | "marks every body they pass" | griefResist +0.05; logs killer to memory once (`memory.ts`) | sanityDrain +0.05 |
| Q8 | "keeps one sip for later" | thirst-death threshold delayed 1 cycle once (`survival.ts`) | thirstDrain +0.2 |

#### Stances (3)

New `Stance` union members (`types.ts:47`) with availability predicates in `stance.ts`.

| id | stance | condition | behaviour | takes share from | counter |
|---|---|---|---|---|---|
| S1 | Rallying | alliance leader; ≥ 1 ally separated | stays put, signals (`signallingPull` +1), and becomes defended +0.2 for each ally who arrives | Evasive (21.8%) | signalling also draws hunters: targetDraw +1 |
| S2 | Pursuing | an enemy fled a fight with them last cycle and is wounded (`bleedSeverity` > 0) | follows the blood trail one zone; `executeDrive` +0.2 | Aggressive and Hunting | walks into ambush (`rollAmbush` +0.05 against them) |
| S3 | Retreating | lost the last exchange, health < 50, not cornered | moves away and fights at retreat +0.1; no forage | Desperate (3.0%; the worst-outcome stance) | Pursuing (S2) is its counter |

`Pursuing` appears in `DossierPanel.tsx` and `AUDIT-4.md` as prose, not as a stance. Rename it to `Blood-Trailing` if that collides in the UI.

#### Personas (4)

These are new `InterviewPersona` union members. Each also needs an `INTERVIEW_SCENARIOS` row, a `PERSONA_THREAT` value, a `PERSONA_FAMILY` entry and bloc affinity (`personas.ts`).

| id | persona | threat | family | hook | niche |
|---|---|---|---|---|---|
| P1 | The Outsider | −0.1 | underdog | outer-district sponsorTrust +0.5 when the Careers lead; alliance offers from non-Careers +0.1 (`alliance.ts`) | a counterweight to A28 small-field Career dominance |
| P2 | The Showboat | +0.2 | firebrand | excitement +0.3; the first kill doubles its sponsor effect (`sponsors.ts`) | a high-variance crowd play |
| P3 | The Scrapper | +0.1 | loyalist | industry bloc +1.2; the first fight's retreat −0.03 (stands their ground) | an outer-district fighter persona (D3/D5/D6) |
| P4 | The Oracle | +0.05 | enigma | the first two rumours are believed +20% (`rumours.ts` credibility) | social information play, distinct from Mysterious Enigma (LO, A41) |

#### Suggested order

1. A28 (the metrics guard change, then the small-field horn fix).
2. A29 (D3/D5/D6 crafts).
3. A38 (skill inflation).
4. A32 and A33 (confessor, duellist, showrunner).
5. A35 (gambler).
6. A34 (hermit isolate).
7. New content, with T1 Horn-Shy, T15 Hand-Me-Down and R4 Tinker first, because they reinforce A28 and A29.

Re-measure with the 12-district-only harness (E9) at ≥ 1,600 runs before shipping any numeric change.

---

## 8. Side systems, replayability, shallow features, achievements, names


Scope: sponsors, the player's booth, prediction and side markets, season and campaign, storage and migrations, share links, daily and weekly rules, draft mode, scenario cards, what-if, replay, achievements and names. I read AUDIT-13 §11–§15 and the CHANGELOG "AUDIT-13 implementation" bullets. Items already listed in AUDIT-13 S1–S7, P1–P8 and H1–H5 are not repeated here.

A finding is marked **Confirmed** only when a scratch script reproduced it. All scratch scripts are in `scratchpad/` (t1–t5.ts, rep.ts, check.ts). src/ and scripts/ were not modified.

---

### Side features

| ID | Sev | Status | Evidence | Finding | Fix |
|---|---|---|---|---|---|
| S1 | P1 | Confirmed | `src/utils/campaignLink.ts:62` `MAX_DISTRICT = 13`; t1.ts | Run links throw away every campaign record for districts 14–16. I encoded `patronDistricts:[3,14,16]`, `districtCrowns:{14,3}`, `districtReputation:{15,2}`, `recentRuns:[{16},{2}]` and `victorMentors:{16}`. The decode gave back `patronDistricts:[3]`, `districtCrowns:{3}`, `recentRuns:[{},{2}]` and `districtReputation:{2}`. D14–16 crowns, mentors, heirlooms, reputation, `lastVictorDistrict` and feuds were all gone. `decodeCampaignResult` still returns `status:'ok'`, so the receiver is told the replay is exact when it is not. `districtCount` is legal up to 16 (types.ts:2958). | Set `MAX_DISTRICT = 16`, or import the generator's cap. Add a D16 round-trip case to `check-storage-migrations`. |
| S2 | P1 | Confirmed | `panemStorage.ts:510–515` (`asObjMap` passes values through), `careerTotals` :780–800; t2.ts | A corrupted record book crashes the Panem Record Book screen. `readStored` promises "never throws", but `PANEM_SPEC.migrate` passes `bests`, `gamemakerRecords`, `districtCrowns`, `victorMentors` and `recentRuns` through without checking them. With `districtCrowns:{3:null}`, `careerTotals` throws *Cannot read properties of null (reading 'archetypes')*. `gamemakerRecords:{x:null}` throws on `deaths` and `bests:{a:null}` throws on `name`. `careerTotals` renders in `PanemRecordBook.tsx:140`. `recentRuns:[null]` gets through the same way and reaches `continuity.ts:78` (`r.victorDistrict`) during reaping. | Validate every map entry the way `campaignLink.districtMap` already does. Drop non-object entries and entries without a finite count. |
| S3 | P1 | Confirmed | `hofStorage.ts:47 capWithPins`, `:206 importHallOfFame`; t5.ts | Importing a Hall of Fame file can wipe the player's own victors. I imported 60 entries marked `pinned:true` and dated 2099 over 10 of my own. The result was *"Imported 60 new records · 10 oldest dropped"*: my records kept 0, total 60, which is over the 50 cap. The pin flag and future dates in the file are trusted. Imported victors then feed the victor-return Quell (P7) and the mentor lineage. | On import, set `pinned=false`, clamp `date` to now or earlier, and never evict existing entries to make room (reject the overflow). Enforce the hard cap even when everything is pinned. |
| S4 | P2 | Confirmed | `panemStorage.ts:726 dailyStreakOf`; t4.ts | The daily streak never expires. Seven dailies from 2025-03-01 to 03-07 still return a streak of 7 in September 2026. The streak counts back from the newest daily *played*, not from today, so `a13-daily-streak-7` can be earned in any week of any year. | Count only when the newest date is today or yesterday in UTC. Otherwise the streak is 0. |
| S5 | P2 | Confirmed (engine) / Plausible (UI) | `replayHooks.ts:253 dailyDateOf` is a regex on the seed; `SetupScreen.tsx:575` has a free seed input | A daily streak can be typed in. Any seed matching `daily-YYYY-MM-DD` counts as that date's daily, so a player can enter seven consecutive dates in one sitting and earn the streak achievement. | Record a daily only when it was launched from the Daily button on its own date. Store a `launchedAs:'daily'` flag in config instead of inferring it from the seed. |
| S6 | P2 | Confirmed | `panemStorage.ts:743 foldDailyAndWeekly` filters `d.date !== date` and keeps the latest run | The daily result can be farmed. Replaying a daily replaces the row, including `pickRight`. The player watches the daily, restarts it, picks the victor they just saw, and the history (and any "called it" stat) shows a right call. | Keep the *first* completed run per date. Later runs are practice and do not overwrite it. |
| S7 | P2 | Plausible | `foldDailyAndWeekly` calls `weeklyRules()` with `now` at commit time | A weekly run started before the week rolls over and finished after it has a seed that no longer matches `weekly.seed`, so the result is silently not recorded. | Store `weeklyKey` in config at launch and match on that. |
| S8 | P3 | Confirmed (code) | `playerSponsor.ts:131` | Every player parachute uses one fixed line: *"A parachute comes down through the canopy over {zone}…"*. That means a canopy in the Vault, the Salt Mirror, the Glacial Cavern and every underground or indoor arena. With 0 variants it is also the most repeated line for any player who uses the booth. | Route it through `beatVariants` with an arena-skin slot (roof, vent, sky, water) and 6+ variants. |
| S9 | P3 | Confirmed | `season/scenarios.ts:22`; t3.ts | "The Pack of Six" builds a pack of 4 when `districtCount` is 2 or 3 (scenarioCast returns 4). The card's name and blurb do not match what happens, and the setup panel does not gate it. "Strange Allies" promises "sworn allies" but only sets regard to 75, with no alliance or charter formed. | Disable career-six when districtCount < 4, or rename it on the fly. Have rival-allies create a real alliance with a charter. |
| S10 | P3 | Confirmed (code) | `engine/phases/training.ts:315` | Training *failures* are logged with `type:'tribute-paid'`, the same type `parley.ts:465` uses for extortion. Any consumer of `tribute-paid` (a12-fed-by-foes, chronicle filters, soak counts) mixes the two. | Give training failures their own `training-flub` type. |
| S11 | P3 | Plausible | `PANEM_SPEC` accepts `victors > runs*2`; `campaignLink.ts` rejects it | The storage and link validators disagree. A book the game will load produces a run link the game rejects ("more victors than its Games allow"), so a player with a slightly corrupted book cannot share runs. | Clamp `victors ≤ runs*2` in `PANEM_SPEC.migrate`. |

---

### Replayability

**Measurement** (`scratchpad/rep.ts`: a headless production init, default config, fresh campaign). Each event line was turned into a template by replacing names with X, zones with Z and numbers with N. "New" means a template not seen in any earlier run of the series. The runs had no stale-line memory, which is what a player gets on day 1 (`STALE_LINES.windowDays = 3`).

| Series | Run 2 new | Run 10 new | Run 20 new | Run 30 new | Consecutive-run template overlap | New event *types* after run 10 |
|---|---|---|---|---|---|---|
| 30 runs, a different arena each | 65.8% | 32.3% | 27.5% | 20.0% | 18–22% every run | 0–2 per run |
| 20 runs, the same arena (Clockwork Island) | 65.4% | 27.4% | 20.0% | – | 21–26% | 0–6 per run |

- 204 templates (mixed series) and 309 (same-arena series) appeared in at least 80% of runs. Almost all of them are from before the Games: all 5 token-review lines (`beatVariants.ts:123–130`) in every run, because 24 tributes exhaust a pool of 5. The 3 training-day headers and 3 lunches are fixed. The scores intro, Caesar's opener, and roughly 17 interview lines appear in every run. The train, chariot and recap lines are fixed too.
- By run 20, about 80% of what the player reads has been read before. The first 150–200 lines of every run (reaping to gong) are close to 100% familiar. A 20th-run player sees something new mainly in the arena phase: arena-specific events, the zone-state and weather-chain lines, and rare set pieces.

| ID | Proposal (not in AUDIT-13 P1–P8) | Why |
|---|---|---|
| P1 | **Pregame fast-forward and pregame variety budget.** From run 5 on, fold the reaping-to-gong sequence into a one-screen "Road to the Arena" digest of the 6–8 notable beats (odd scores, a volunteer, a token kept, a standout interview) by default. Also enlarge the token, training-header and lunch pools to ≥ 3× the number of draws per run. | 100% repetition sits in the first ~15% of every run, where the player judges freshness. |
| P2 | **Interview questions built from the tribute** instead of a pool of about 24 lines: question = f(archetype, district standing, nemesis/reunion, training score band), answer = f(persona, quirk). | 17 of the interview lines appear in every run. The data to make them specific already exists. |
| P3 | **Run "headline twist" deck.** One seeded, announced twist per Games drawn from 20+ small authored rules that are not mutators (e.g. "the Horn is empty until day 2", "one district's pair start separated", "cannons are silent tonight"). They show on the briefing and are logged in the HoF. | Consecutive-run overlap stays flat at about 20%. The structure of every run (bloodbath → forage → feast → convergence) never changes. |
| P4 | **Rivals that persist across Games as named NPC careers.** The Capitol "favourite" rival bettor has their own slip and bankroll and taunts in the recap. | It gives the betting layer a face and a reason to beat someone, not just a number. |
| P5 | **Discovery log / codex.** A per-career list of seen event types, causes, set pieces and arena signatures, with silhouettes for unseen ones. `deathsSeen` and `eventsSeen` are already stored in `PanemRecords` and only feed achievements. | It tells the 20th-run player *what is left* to see. Novelty that the player cannot see does not help them. |
| P6 | **Tribute memory of past Games.** Reaped tributes whose sibling or district-mate died in a prior Games in the book get a grief/revenge quirk and a reaping line. This is the ledger idea applied to ordinary tributes, not only victors and nemeses. | It makes consecutive Games feel connected rather than stateless. |
| P7 | **Stale-line window scaled by play rate.** `windowDays: 3` and `cap: 800` fall short of one day's worth of templates (about 1,200–1,500 per run). Key the window on *runs*, not days (for example the last 5 runs), and raise the cap to about 6,000 hashes. | Heavy players replay several times a day. After 3 runs the cap is full and the memory stops helping. |

---

### Shallow or incomplete features

| ID | Status | Evidence | Finding | Fix |
|---|---|---|---|---|
| F1 | Confirmed | `grep zoneState\|deathSite src/components src/screens src/ui` finds 0 hits | The AUDIT-13 W11–W16 zone states (damaged, ruined, flooded, burning, ash, regrowth), haunted death sites and the day-8 finale mutation change forage and concealment, but the map and zone strip never show them. The player cannot plan around them or even notice them. | Add a zone-state glyph on the map and zone strip, and a "haunted" marker. Add a finale-mutation banner. |
| F2 | Confirmed | Write-only `GameState` fields: `giftedQuantity` (parachutes.ts:49), `weatherChainsCompleted` (arenaDynamics.ts:289), `deathSitesNoted`, `recentHeadlines`, `hazardAftermaths`, `musterPayouts` (read only by soak scripts) | These counters are maintained but nothing in the game reads them: no UI, recap or achievement. | Either surface them in the debrief ("3 weather chains ran; 12 items gifted") and in achievements (see a14-weather-chain-full), or delete them. |
| F3 | Confirmed | `data/replayCards.ts:16–25`, `:35–38`, `:49–54` | The AUDIT-13 replay systems are thin. There are 3 scenario cards, 4 commentators and 5 story chains. By the 4th run a scenario-card player has seen every card. | Add 12+ cards (e.g. the Twins, the Career defector, the Mentor's Favourite, the Blind Draw), 3 more voices and 10 more chains. |
| F4 | Confirmed | `grep draft\|weekly\|commentator\|challenge\|legacy src/data/achievements.ts` finds 0 ids | Draft mode, weekly rules, the change-the-winner challenge, commentator voices, legacy drift, arena scars and the victor-return Quell shipped without achievements. Only scenario cards got them. This leaves the new modes with no goals. | See the a14-draft-*, weekly, changed-winner, scar and return-quell entries below. |
| F5 | Confirmed | `sendPlayerParachute` has one line; `sponsorableItems()` is item-only | The player's booth has one verb (send an item). There is no message note, no "hold for tomorrow", and no conditional gift ("if they reach the river"). The blocs have bidding wars but the player only pays list price. | Add a paid note (a morale effect plus a line), a scheduled drop, and letting the player bid in a bloc war. |
| F6 | Plausible | `whatIf.ts` is 114 lines; branches are "never reaped" and "alliance never formed" | What-if has two counterfactual kinds. There is no "gift not sent", "feast not called" or "this kill missed". | Reuse `interventionLog` to offer "undo this intervention" branches, which P2 challenge already replays. |

---

### Achievements

`ACHIEVEMENT_RUNS=300 npx tsx scripts/check-achievements.ts` (scripted player on) checked 480 entries. Result: **FAIL**. 72 never unlocked, 21 unlocked in ≥ 60% of runs, 238 of 480 fell in the 5–60% band, and 11 rarity labels were contradicted by the measured rate.

| ID | Status | Evidence | Finding | Fix |
|---|---|---|---|---|
| H1 | Confirmed | Script output: "FAIL: … a12-fed-by-foes (no nearMiss)" | The check fails on `main` because `a12-fed-by-foes` (achievements.ts:6526) has no nearMiss. It unlocks only when the *victor extorts* food in a parley (`parley.ts:465`, receiver = `tributesInvolved[1]`), which does not match the hint "paid food by a tribute from another side". The shared `tribute-paid` type (S10) adds noise on top. | nearMiss: "the victor extorted a toll, but not food". Change the hint to "extorted food". |
| H2 | Confirmed | 78.0% measured vs "common (~30%)" proposed in AUDIT-13 | `a13-volunteer-first-blood` is near-automatic. | Also require the victim to be a non-Career from D5 or higher and the kill to be in the first bloodbath cycle. Target ~25%. |
| H3 | Confirmed | 0/300: a13-sponsor-war-won, a13-mentor-lineage, a13-nemesis-avenged, a13-rival-final-two, a13-gauntlet-clean, a13-cruelty-zero, a13-upset-called, a13-side-market-sweep, a13-apprentice-wins, a13-reunion-final, a13-scenario-strange-allies, a13-career-wiped-bloodbath | 12 of the 37 AUDIT-13 additions never fired. Most need a ledger (nemesis, rival, reunion, apprentice, lineage), and the harness always starts from `FRESH_CAMPAIGN`, so they are unmeasurable rather than broken. | Add a "campaign mode" to check-achievements that folds 5 runs in sequence through `commitRun` into an in-memory backend. Tag ledger-only entries `requiresCampaign` so they are excluded from the per-run coverage floor. |
| H4 | Confirmed | ≥ 60%: a8-everybody-knew-everybody 97.7%, kept-word 93.7%, the-empty-camps 89.7%, the-pack-that-held 89.0%, four-skills 82.0%, outlived-the-map 80.7%, a7-decided-in-the-convergence 80.7% | These are close to participation trophies. kept-word is a single flag (`keptWordSeen`). | a8-everybody-knew-everybody → the final *six*; kept-word → the truce must survive ≥ 2 renewals and be kept by the victor; the-empty-camps → 3 or more camps; four-skills → six skills; outlived-the-map → ≥ 50% of zones closed. |
| H5 | Confirmed | Labels contradicted: caught-out, three-fingers, feared (common → uncommon, ~24%); beastmaster, whisper-campaign, dual-victory, a7-lowest-in-the-field, short-rations (rare → uncommon, 2.7%); sky-of-cannons, the-carpenter, a12-called-it (possible → legendary, 0.3%) | The labels drifted after the AUDIT-13 balance changes. | Re-run `ACHIEVEMENT_EMIT_RARITY=1`. |
| H6 | Confirmed (S4/S5) | – | `a13-daily-streak-7` can be earned without a real streak. | It depends on the S4/S5 fixes. |

#### New achievements (42, all checked: no id or case-folded name collision with the 517 ids / 507 names in `src/data/achievements.ts`)

Overlaps I checked: *Quiet on Stage* is distinct from `nobodys-favourite` (that one measures reputation and fan status, this one measures interview reception only). *Two Quiet Days* is a strict tightening of `nobody-died-today` (63%) and could replace it. *Two Seasons of Hate* is the cross-season version of `a13-nemesis-avenged`. Every numeric entry needs a nearMiss.

| id | name | condition | expected rarity |
|---|---|---|---|
| a14-draft-podium | Podium Pick | A drafted tribute (draft mode) wins the Games | uncommon (~17% of drafts) |
| a14-draft-clean | Full Card | All 4 drafted tributes reach the final eight | rare (~2%) |
| a14-draft-bust | Scratched | All 4 drafted tributes die on day 1 | rare (~1%) |
| a14-draft-five | Fantasy League | Play 5 drafts (`ledger.draftsPlayed ≥ 5`) | meta |
| a14-weekly-max | Perfect Week | A weekly-rules slip scores its maximum | rare |
| a14-weekly-four | Four Sundays | Record a weeklyBest in 4 different week keys | meta |
| a14-changed-winner | Butterfly | Pass the change-the-winner challenge with one intervention | uncommon (player) |
| a14-changed-to-d12 | Long Arm | The challenge moves the crown to a tribute from the highest district in the Games | rare (player) |
| a14-every-voice | Four Voices | Finish a Games under each of the 4 commentator voices | meta |
| a14-pirate-feed-upset | Off the Books | The victor was priced 10:1 or longer while the pirate-feed commentator was on | rare |
| a14-scar-returned | Old Wound | A tribute dies in the zone an arena scar marks | uncommon |
| a14-scar-avoided | Nobody Went Back | The arena has a scar and nobody enters the scarred zone all Games | uncommon |
| a14-return-quell-rookie | New Blood | A non-veteran wins a victor-return Quell | uncommon |
| a14-return-quell-repeat | Twice Crowned | A returning victor wins the victor-return Quell | common inside that Quell (~40%) |
| a14-legacy-riser | Rising Tier | Legacy drift moves a district up a tier | meta |
| a14-legacy-fallen | Forgotten Again | A storied district drifts down to thin or forgotten | meta |
| a14-season-bank-top | House Money | Finish a 5-Games season top of the season bankroll board | meta |
| a14-season-bust | Busted Out | The season bankroll hits 0 before Games 5 | uncommon (player) |
| a14-parlay-four | Four-Leg Ticket | Land a 4-leg parlay | rare (player) |
| a14-slip-perfect-cause | Called the Cause | The first-death-cause pick and the over/under are both right on the same slip | uncommon (player) |
| a14-regret-defied | Won Them Back | Gift a tribute from a district under patron's regret, and they win | rare (player) |
| a14-gift-last-alive | Last Parachute | A player parachute lands on day 8 or later and that tribute wins | uncommon (player) |
| a14-gift-wasted | Dead on Arrival | A tribute dies in the same cycle a player parachute reached them | uncommon (player) |
| a14-mentor-feud-final | Their Masters' War | The final two are mentored by feuding victors (campaign feuds) | rare |
| a14-heirloom-home | Brought It Home | The victor carried their district's heirloom token into the arena | uncommon (campaign) |
| a14-chain-broken | Chapter Unwritten | A story chain step fails to fire because its zone collapsed first | uncommon |
| a14-museum-first | Opening Night | The first museum piece in any arena | meta (common) |
| a14-mastery-sweep | Surveyor General | Arena mastery bronze in 10 different arenas | meta |
| a14-zone-burned-won | Walked Through Fire | The victor stood in a burning or ash zone on the final day | uncommon |
| a14-flooded-hideout | High Water | A tribute dies in a zone the day after it flooded | uncommon |
| a14-haunted-kill | Unquiet Ground | A kill happens at a haunted death site | uncommon (~25%) |
| a14-weather-chain-full | Three-Part Sky | A 3-step weather chain completes and the victor was outdoors for all of it | uncommon |
| a14-finale-mutation-kill | The Floor Moved | The day-8 finale mutation causes a death | uncommon |
| a14-token-kept | Let Through | A tribute's token passes the review board and they carry it to the win | uncommon |
| a14-first-cannon-career | Pride Before | The first cannon of the Games is a volunteer Career | uncommon (~8%) |
| a14-no-interview-favourite | Quiet on Stage | The victor had the lowest interview reception in the field | rare |
| a14-odds-in-order | Chalk | The final four finish in exact reverse order of their pre-Games odds | rare |
| a14-all-districts-final-eight | Sixteen Flags | With 16 districts, the final eight come from 8 different districts | uncommon |
| a14-cross-season-nemesis | Two Seasons of Hate | A ledger nemesis pair meets in the final three two seasons apart | legendary (meta) |
| a14-daily-called-three | Three Mornings Right | pickRight on 3 consecutive dailies (first run of each day only, after S6) | rare (meta) |
| a14-bloodless-day-three | Two Quiet Days | No death on day 2 or day 3 | uncommon |
| a14-market-contrarian | Against the Book | Win a side bet priced under 15% | uncommon (player) |

---

### Names (single given names only)

`npx tsx scripts/check-names.ts` passes: 4,633 names across 16 districts, 288 in two pools, no fold collisions in 2,000 casts, an initial spread of 4.4:1 (S 408 to Z 92), and 204 mentors. One themed note: D12 carries "Shale", a D2 stone name.

| District | Male | Female | Neutral | Thinnest? |
|---|---|---|---|---|
| 1 | 126 | 135 | 30 | M |
| 2 | 139 | **125** | 28 | F |
| 3 | 138 | 127 | 32 | |
| 4 | 142 | 131 | 30 | |
| 5 | **125** | **124** | 30 | M+F |
| 6 | 133 | 130 | 28 | |
| 7 | 129 | 128 | 28 | |
| 8 | **125** | 129 | 27 | M |
| 9 | 129 | 127 | 28 | |
| 10 | 143 | 132 | **26** | N |
| 11 | 140 | 134 | 27 | |
| 12 | 144 | 134 | **26** | N |
| 13 | 130 | 127 | 27 | |
| 14 | 128 | 126 | 27 | F |
| 15 | **123** | 130 | **26** | M+N |
| 16 | 132 | **124** | **24** | F+N |

**Method.** I proposed 372 candidates. `scratchpad/check.ts` NFD-folds and lower-cases each one and compares it against every `DISTRICT_NAMES` Male/Female entry, every `NEUTRAL_NAMES` entry and every `DISTRICT_LEGACY[*].mentors`. 146 collided. That included 4 mentors (Prismo D15, Faradine D3, Ballast D6, Adit D12), which confirms the M2 density note. 1 was an internal duplicate (Ozias). I removed 19 by hand as surname-like, awkward or insensitive. **226 remain, with 0 collisions and no whitespace.** Rare initials (Q, U, X, Y, Z, I, O) come first.

- **D1 Male (27):** Zafir, Quentin, Ysandre, Ulisse, Xavier, Jaspar, Onyxian, Aurelio, Filigran, Moissan, Sapphiro, Tanzan, Rubellan, Ivoire, Damascene, Kunzo, Ozmund, Yves, Lazulo, Xavi, Isandro, Zenobio, Topazio, Lustran, Siloam, Brillo, Tourmal
- **D2 Female (25):** Ursula, Ilona, Onyxa, Masonne, Gravella, Graniet, Brecciana, Tufa, Cairna, Dolmena, Plinthe, Scoria, Zelda, Ottavine, Vigila, Ramparta, Glaciska, Quarryn, Ursa, Zofia, Olwen, Isaura, Cantera, Chisella, Travia
- **D5 Male (13):** Zeppo, Yuri, Ozias, Uziel, Tesloy, Ignaz, Joulian, Quade, Oberon, Ulysses, Zorion, Izaak, Arcward
- **D5 Female (19):** Quenby, Yselda, Iskra, Wattsie, Amperelle, Joulie, Yevna, Galvina, Ionella, Luxie, Zdena, Ursule, Ivette, Zoya, Oriette, Dynamia, Gridella, Uma, Zelma
- **D8 Male (16):** Tatting, Quilter, Ikat, Xeno, Zarek, Organzo, Loomis, Shuttleton, Vicuna, Pashmin, Brocard, Fustian, Calicot, Ignatz, Izidor, Tussore
- **D14 Female (30):** Quiesca, Yukiko, Xiomara, Salina, Sleetie, Rimeza, Glacina, Nevada, Icelyn, Sorbetta, Frazil, Ozerka, Tundria, Xarifa, Yzolde, Snezana, Blizza, Kristalla, Yelena, Olga, Iglika, Zima, Quinta, Oyuna, Xylina, Salinda, Frostelle, Glissade, Kryo, Hielita
- **D15 Male (24):** Ulrik, Zoltan, Oskar, Ugo, Iolo, Luxan, Diopter, Yorick, Ilario, Vasco, Kaleido, Ximeno, Vitreo, Lucernan, Yitzak, Ottokar, Iwan, Umbert, Zbigniew, Refractor, Ulf, Ingvar, Xaver, Loupe
- **D16 Female (19):** Naphtha, Kerosina, Oriana, Zaida, Yael, Ulrica, Brinella, Zosia, Maristel, Wellsa, Sondra, Ysabel, Ivana, Orsola, Yvonne, Derricka, Pumpella, Petrella, Oceane
- **Neutral D16 (8):** Sounding, Tideline, Mooring, Rigwell, Sluice, Pumpjack, Borehole, Tidewater
- **Neutral D10 (5):** Fodder, Stockyard, Branding, Calving, Ranchero
- **Neutral D12 (10):** Pitwick, Coalbrand, Lampblack, Seamline, Stope, Kibble, Pithead, Firebrand, Clinker, Smoky
- **Neutral D15 (7):** Mirror, Lens, Molten, Lustre, Vial, Lenticle, Etching
- **Neutral D13 (6):** Isotope, Fuse, Detonator, Payload, Fulcrum, Recoil
- **Neutral D8 (7):** Skein, Dart, Fringe, Ruffle, Button, Bias, Placket
- **Neutral D14 (8):** Floe, Snow, Iceberg, Floeline, Sastrugi, Graupel, Hailey, Serac
- **Neutral D11 (2):** Graft, Hayloft

Notes: a few are common real given names (Yuri, Oskar, Quentin, Xavier, Yvonne, Olga, Ursula). They pass the fold check but should be re-run through `npm run test:names` after insertion. After adding these, the pools are D15M 147, D5M 138, D5F 143, D8M 141, D16F 143, D2F 150, D1M 153, D14F 156 and D16N 32.

---

## 9. Suggested order of work

1. **Integrity first:** §4 U2 (undo/bet rewind), §8 S1–S3 (lost links and saves, the Record Book crash), and the failing `check-achievements` (§8 H1).
2. **AUDIT-13 regressions:** §6 W1–W2 (label leak, `refineHazardCode`), §3 E9–E10 (cause codes), §3 E1–E8 (stances, corpse caches, zone states, betrayal intent).
3. **Relationship arcs:** §5 RB1–RB3, then RB4–RB8. Add guards to `test:audit13-relations`.
4. **Balance:** a per-head Career guard and the small-field horn fix; craft changes for D3/D5/D6; Confessor, Pilgrim and Mourner; build the Hermit "isolate" objective (§7).
5. **Tribute logic:** stance softmax/diversity, aligning Hunting with the hunt objective, a target-scoped vengeance fear waiver (§3 T-items).
6. **Content waves:** §6 deaths and events for the thinnest arenas, then §7 new traits/archetypes, §8 achievements and names.
7. **QOL and replayability:** §4 Q-items and §8 P/F-items (a twist deck, a discovery codex, surfacing zone states and haunted sites).
