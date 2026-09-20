# Survival Games — current-code audit and expansion plan

Audited commit: `4135976104dfd8b9ef6ab86123525108f0b8ed3b` on `main`.

Repository: https://github.com/icamcmusic-ship-it/survival-games

This is an audit, not an implementation release. No production source was changed, and nothing was pushed. Findings below distinguish reproduced defects, source-confirmed defects, measured design gaps, and proposed additions. An audit cannot guarantee discovery of every bug; this covers every requested subject and records the limits of validation. Earlier audit documents were used as context, not as evidence that an old defect still exists.

**Main conclusion:** the game already has substantial breadth. Its largest remaining opportunities are reliable reporting, consistent physical rules across subsystems, stronger consequences for social decisions, and better selection and presentation of existing content. More content should deepen these interactions rather than simply enlarge the random pools.

## 1. Why Cornucopia deaths always display zero

**Confirmed and reproduced.** In `src/utils/notables.ts:97`:

```ts
const bloodbathDeaths = dead.filter(t => t.dayOfDeath === 0).length;
```

But `startGames()` in `src/engine/phases/bloodbath.ts:27–30` sets `day = 1`. `killTribute()` in `src/engine/combat.ts:1523` records the current day. At the end of the bloodbath, `bloodbath.ts:675–676` already marks its victims with `diedInBloodbath = true`.

The summary asks a question that no normal bloodbath death can satisfy. It consequently generates the low-death highlight with a zero count; its weight of 7 makes that false highlight competitive for the three displayed slots. The highlighted line is not guaranteed to appear in every game, but its count is wrong whenever this branch appears after a nonempty bloodbath.

**Measured reproduction:** 120 complete runs, seeds `audit-current-0` through `audit-current-119`, cycling the 45 authored arenas with the default configuration:

| Measurement | Result |
|---|---:|
| Actual bloodbath deaths, using the phase flag | 920 |
| Deaths stamped day 0 | 0 |
| Runs displaying “nobody died at the Cornucopia” despite more than two bloodbath deaths | 102 / 120 |
| Example `audit-current-1` | 8 bloodbath deaths, all stamped day 1; displayed nobody |

**Correct repair:**

```ts
const bloodbathDeaths = dead.filter(t => t.diedInBloodbath === true).length;
```

Do **not** replace 0 with 1: day 1 also contains deaths after the bloodbath. The nearby `earlyFavourite` test at line 193 has the same day-zero mistake and should use the same phase flag.

Also change “Only nobody died…” to “Nobody died…” for a genuinely bloodless opening. For an old save without the flag, reconstruct only from trustworthy bloodbath death records; otherwise treat the count as unknown. Missing historical data must not become a confident zero. If archived summaries are stored as text, decide whether to regenerate them from a complete saved run or preserve them with an explicit legacy limitation.

Regression cases: zero actual bloodbath deaths; one and two; a large massacre; deaths on day 1 after the bloodbath; an early favourite dying at the horn; and a legacy record with insufficient evidence.

[Summary source](https://github.com/icamcmusic-ship-it/survival-games/blob/4135976104dfd8b9ef6ab86123525108f0b8ed3b/src/utils/notables.ts#L96-L102) · [Bloodbath flag](https://github.com/icamcmusic-ship-it/survival-games/blob/4135976104dfd8b9ef6ab86123525108f0b8ed3b/src/engine/phases/bloodbath.ts#L675-L676)

## 2. Bug and robustness findings

P1 means repair before expanding the affected mechanic. P2 means a real correctness issue or material quality problem that should follow. Reproduced fixtures demonstrate a defect in a function; they do not establish how often it occurs in ordinary play.

| ID / priority | Evidence and consequence | Required repair and acceptance condition |
|---|---|---|
| B01 / P1 | **Reproduced:** Cornucopia summary reads day 0; 102 false displayed highlights in 120 runs. | Use `diedInBloodbath`; distinguish unknown legacy data. See section 1. |
| B02 / P2 | **Source-confirmed:** the early-favourite highlight in `notables.ts:193` also reads day 0 and misses normal horn deaths. | Use the phase flag; test favourite deaths inside and outside the bloodbath. |
| B03 / P1 | **Reproduced:** `bloodbath-massacre` in `data/achievements.ts:1043` counts every day-1 death, whereas `a7-half-at-the-horn` counts the flag. Both describe losing half the field in the bloodbath. A 24-person fixture with 3 horn deaths and 9 later day-1 deaths awards only the first. | Use one semantic predicate. Merge the duplicate concept or give one a genuinely different condition. Migrate existing unlocked IDs; do not pay the same discovery twice. |
| B04 / P1 | **Reproduced in a real run:** seed `audit-current-40` crowns Florian and Marlina together; the notable says Florian “came out of them alone.” `isStarCrossed(victor)` is treated as proof the partner died. | Resolve the actual partner and all winners. Cover surviving partner, dead partner, other dead lovers, and two-winner endings. |
| B05 / P2 | **Measured:** the largest-pack notable reads the final live alliance records. 119/120 runs had a pack of at least five during play; none retained one in the final state. | Persist peak size and preferably the alliance ID, members and duration. A historical statement must read a historical record, not the surviving alliance registry. |
| B06 / P2 | **Source-confirmed semantic mismatch:** the vengeance notable detects a `VENGEANCE` prose prefix. That line records an oath, but the summary claims the mourner went and found the killer. The probe saw oaths in 120/120 runs and a typed `vengeance-paid` event in only 32. This does not prove no pursuit in the other 88; it proves the detector measures the wrong event. | Separate “swore,” “pursued,” “confronted” and “fulfilled.” Select typed evidence matching the sentence. Do not infer completion from an oath. |
| B07 / P1 | **Reproduced:** `utils/chronicle.ts` selects the first living tribute as winner in Markdown, text/BBCode and prose exports. An unfinished setup export names a victor; a dual-win export names only one. Titles can also say “The The … Games.” | Use terminal outcome status plus the full winner list. Centralize arena-title formatting. Test all export formats for unfinished, single, dual and zero-winner runs. |
| B08 / P1 | **Source-confirmed:** `utils/panemStorage.ts:532` uses the first survivor for `commitRun`, district crowns, mentor succession and patron-win bookkeeping. The store archives both winners separately, so different record systems disagree. | Separate games-with-a-winner, people crowned, and district wins. Credit every winning district once per game; define same-district dual-win semantics. Persist all winning people for history and mentor selection. |
| B09 / P1 | **Source-confirmed:** `scripts/metrics.ts:319` credits only the first survivor to archetype, district and trait win counts. Co-winners are omitted, with array order deciding whose result survives. | Count every winning entrant for entrant win rates; retain a separate denominator for run outcomes. Re-run balance after correcting this before making fine tuning decisions. |
| B10 / P1 | **Reproduced:** `actionBudget.work()` keys partial work only by kind. A three-hour fixture completes after two hours in one zone plus one hour in another (the production shelter currently costs five hours; the identity defect is the same). `fieldcraft.buildShelter()` then creates the shelter at the current zone. Same issue applies to trap and mitigation job identity. | Store job identity, zone, level, target/forecast ID and required work. A fixed construction stays at its site; portable crafting must be explicitly portable. Include save/load and abandoned-site cases. |
| B11 / P1 | **Reproduced boundary case:** resuming three completed hours against a newly reduced two-hour total calls `spendUpTo(-1)`. One remaining hour becomes two, the job returns false, and partial work remains. Mitigation recomputes required hours from carpentry, so its cost is not immutable. Natural frequency was not measured. | Finish immediately when remaining work is zero or negative; never allow negative expenditure. Choose fixed-at-start or explicitly recalculated work requirements and test skill changes during a job. |
| B12 / P1 | **Reproduced:** `obligations.ts:179` uses zone equality for togetherness. A supply promise is marked kept and bread transferred from upper to lower level while `samePlace()` returns false. Rescue and escort fulfilment use the same weak check. | Use `samePlace` for physical interaction and the appropriate active/transit state checks. Test disconnected levels, transit, incapacitation and legitimate same-level fulfilment. |
| B13 / P1 | **Source-confirmed:** supply fulfilment removes the donor's item, ignores the dropped items returned by `giveItem`, and marks the obligation kept. A full recipient can discard the incoming supply or another item without this caller preserving the dropped inventory. | Use an atomic transfer result: retained, dropped, refused. Put dropped items into the local cache and keep the promise only according to a defined delivery contract. Test full bags and merged stacks. |
| B14 / P1 | **Reproduced:** `giveItem()` merges stacks by item ID alone. One bread with spoilage 1 plus one bread with spoilage 9 becomes two bread with spoilage 1. Reversing arrival order can extend old food's life. | Preserve batches or merge only compatible metadata. Test quantity and freshness conservation, both orders, overflow and save/load. This is an actual spoilage issue, not just a hypothetical future provenance concern. |
| B15 / P1 | **Reproduced at the selector boundary:** `pickTerrainEvent()` restores ineligible events when none pass requirements; if all are spent it restores the original pool. A medical-required event is selected for an empty inventory; a once-per-run event is selected again. `pendingChain()` also does not revalidate current requirements. | Hard requirements and once-only restrictions must never be relaxed. Return no event or an explicitly safe ambient fallback. Revalidate delayed chains; relax only optional novelty preferences. Measure production fallback frequency separately. |
| B16 / P2 | **Source-confirmed:** the text-size setting changes root `font-size`, while many interface labels use fixed `text-[10px]`, `text-[11px]` and similar pixel sizes. Those labels do not scale with the preference. | Use scalable type tokens for player-facing text. Verify the largest setting and browser zoom on narrow screens. The existing setting is real; its coverage is incomplete. |

Additional robustness work, not asserted as reproduced gameplay bugs:

- `planArenaEvents()` retries day spacing a finite number of times and then accepts a collision. If spacing is a hard design rule, allocate valid calendar slots or report an unsatisfiable schedule. If it is a preference, describe it that way.
- `runDelta()` calls a higher final death count “bloodier.” With one victor, that mostly measures cast size, because final deaths are almost always cast size minus one. Compare mortality timing, kill share and deaths per entrant instead.
- Several summary lines are threshold-based flavour, although the UI describes them as measured against personal history. Distinguish “notable moments” from “unusual compared with your last Games.” Add actual historical baselines for the latter.
- The first dead/unreachable creditor can block `repayDebts()` from considering smaller actionable debts, because it chooses the largest before checking availability. Decide whether stubborn fixation is intended personality or an accidental universal policy.
- Root-level numerical helpers should reject NaN, infinity and negative costs at import boundaries. Validate job/forecast identities and references after migrations.
- The named build passes with **17 ESLint warnings**. Some concern ref access and effect-driven updates; they are review items, not proof of 17 visible bugs. Fix actual stale-effect and mutation problems rather than globally suppressing warnings.

Source anchors: [work accounting](https://github.com/icamcmusic-ship-it/survival-games/blob/4135976104dfd8b9ef6ab86123525108f0b8ed3b/src/engine/actionBudget.ts#L173-L202), [promises](https://github.com/icamcmusic-ship-it/survival-games/blob/4135976104dfd8b9ef6ab86123525108f0b8ed3b/src/engine/obligations.ts#L158-L211), [stack merging](https://github.com/icamcmusic-ship-it/survival-games/blob/4135976104dfd8b9ef6ab86123525108f0b8ed3b/src/engine/items.ts#L216-L270), [event selection](https://github.com/icamcmusic-ship-it/survival-games/blob/4135976104dfd8b9ef6ab86123525108f0b8ed3b/src/engine/encounters.ts#L481-L525).

## 3. QOL, UI and UX

Already present: setup tabs, command palette, tribute follow/filter controls, map/detail/belief views, replay scrubber, comparison tools, colourblind and contrast palettes, text scale, motion preferences, remappable shortcuts and multiple chronicle export formats. These should be improved, not proposed again as missing features.

| Priority | Update | What the player should experience |
|---|---|---|
| P1 | Evidence-backed end summary | Each highlight can open the exact event, phase and people supporting it. Invalid or unknown facts are omitted. |
| P1 | Consistent outcome language | Both winners appear everywhere; unfinished exports say in progress; no false dead-partner story. |
| P1 | Legible larger text | Dossier labels, filters, settings and map annotations scale, with no clipped actions at phone width. |
| P2 | “Why this decision?” expansion | Show the decisive need, belief, alternative and time cost from the existing decision traces. Distinguish knowledge from spectator truth. |
| P2 | Work-in-progress panel | “Shelter: 2 of 3 hours, North Ridge, upper level.” Explain interruption, abandonment and whether another person can finish it. |
| P2 | Promise receipt | Show who owes whom, exact supplies/destination, expiry, and kept/broken/lapsed reason. Make a failed delivery visibly different from a betrayal. |
| P2 | Threat preview | On a route, show known closure warning, journey duration, load penalty and uncertainty. Never reveal concealed truth in a tribute-belief view. |
| P2 | Feed prioritization | Group oath → pursuit → encounter → outcome into a story thread; collapse repeated status ticks. Offer a clear way to expand every event. |
| P2 | Phase-level replay | Day 1 currently bundles the bloodbath and subsequent activity. Add phase selection before promising exact historical health or inventories; those require checkpoints. |
| P2 | Breakpoint controls | Pause for a followed tribute's injury, alliance split, promise failure, imminent hazard or final six. Persist the user's choices. |
| P2 | Reading continuity | Preserve scroll anchor and opened dossier when live events arrive or filters change. Announce new items without stealing focus. |
| P2 | Mobile navigation | Persistent close/back action, useful empty-state explanations and a searchable text equivalent of every graph. Browser validation remains necessary. |
| P2 | Export manifest | Include engine/content version, base/resolved config, arena identity, campaign snapshot and interventions; a seed alone is not a complete replay specification. |
| P3 | Comparable run history | Compare runs with the same rules and cast size; separate procedural map identity from its display name. |

Performance: the production build's main JavaScript chunk is **2,816.81 kB minified / 784.34 kB gzip**, with a separate engine chunk of 324.47 kB / 106.42 kB gzip. This is a bundle measurement, not a measured loading delay. Inspect why setup imports retain large content tables, split record-book/export screens and arena content where practical, and measure cold startup on a slow phone. Consider a worker for long simulation batches only after profiling demonstrates main-thread stalls. Keep a cancel action and deterministic checkpoints.

## 4. Tribute logic: robustness and meaningful complexity

The engine already has needs, intent, memory, confidence, fear, sanity bands, stances, body characteristics, wounds, proficiencies, action budgets and partial jobs. The next work should make these layers agree.

1. **One legal-action contract.** Every physical action checks alive/active state, exact location, transit, equipment, available hours and a valid target. Forced reactions may bypass voluntary budget limits only through a named rule. Apply this to aid, barter, rescue, sabotage and promise fulfilment.
2. **Choose a small plan, then execute it.** Represent “get water, then return to the injured ally” as two or three dependent steps. Replan after a meaningful change, not merely because another system ran next. Record why a plan was abandoned.
3. **Price opportunity costs consistently.** Starting mitigation can exhaust time even if it returns false for incomplete work. Callers need an outcome such as completed/partial/refused; a boolean cannot say whether the tribute already spent the day.
4. **Make beliefs actionable and fallible.** Keep source, confidence, age and last verification. A tribute can decide to verify a rumour, trust a friend or take a risky shortcut. Show the belief behind a mistake rather than giving every tribute global knowledge.
5. **Model learning from the relevant attempt.** Separate “never attempted,” “attempted and failed,” and “succeeded.” Report per-proficiency opportunities, attempts, training and useful outcomes before adding more skill axes.
6. **Personal limits.** Give personalities stable but revisable boundaries: will not abandon a partner, will trade but not give credit, will risk injury but not capture. Extreme need can override one with a recorded consequence.
7. **Recovery as a choice.** Rest should compete with travel, warmth, watch duty and treatment. Distinguish an acute wound stabilised, an infection controlled and full recovery; do not award a rescue for proximity alone.
8. **Enemy adaptation.** Remember an opponent's observed weapon and tactics; change range, route or ally recruitment accordingly. Cap confidence so one encounter does not reveal every stat.
9. **Escalation restraint.** Avoid applying several unrelated catastrophes to the same tribute merely because independent subsystems all rolled true. Budget major beats and allow aftermath scenes.
10. **Causal death records.** Keep immediate cause, contributing conditions, responsible actors and phase separately. A fall while fleeing an attacker is both a fall and a pursuit consequence; one flattened cause string loses that story.

Success measures: fewer invalid intents, fewer unexplained reversals, consistent spent-time totals, more completed multi-step plans, and better diversity of viable strategies. Maximizing the percentage choosing the mathematical top score is not the goal; the current decision check's 55.2% best-stance and 69.5% best-destination rates are observations, not proof of stupidity.

## 5. Relationships and alliances

There are already many social modules: rapport, trust, memories, debts, obligations, pacts, charters, roles, leadership politics, parley, rumours, triangles, vengeance and bloc treaties. Another independent relationship meter would increase disagreement between systems.

**Immediate repairs:** B05, B06, B08, B12 and B13. Use the same spatial and delivery rules everywhere. Put historical alliance membership in a durable record rather than deriving it from former-allies unions or end-state membership.

Recommended depth:

- **A relationship explanation:** “trusts her with supplies; resents her leadership; still owes her medicine.” Use existing axes and events; make directional feelings visible instead of implying perfect reciprocity.
- **A pact lifecycle:** proposed → accepted → active → renegotiated/fulfilled/broken/expired. Capture the actual terms and witnesses. A member dying is not the same as breaking their promise.
- **Scarcity-driven politics:** record what was contributed and what was consumed. Let an alliance debate an expensive rescue or an unequal ration split, with decisions tied to need and charter terms.
- **Specialization with dependence:** scouts bring uncertain information, medics require supplies, guards need rest, carriers slow the group. Roles should change which plans are feasible, not merely add a bonus.
- **Contested leadership:** offer a reason to challenge, support, abstain or leave. Consequences can be a split camp, lost trust or changed route before violence.
- **Reconciliation:** restitution, a witnessed apology or a dangerous rescue can repair a breach. Preserve scars in trust; do not reset a betrayed relationship to neutral after one gift.
- **Credible betrayal:** means, motive, opportunity and expected payoff. A failed attempt can expose the betrayer or create a false accusation. Attribute only what witnesses can know.
- **Conflict between loyalties:** district partner versus current pack; debtor versus target; rescue promise versus escape. Record which obligation won and the cost of that choice.
- **A vengeance arc:** vow, information gathering, pursuit, confrontation, fulfilment or abandonment. 11.65 oaths per run in the large sweep is already enough raw material; prioritize follow-through over more oath text.
- **A last-two negotiation:** actual shared history should affect truces, desperation and dual-win attempts. Do not add a new generic final speech that ignores the preceding ten days.

The 400-run soak observed 521 obligations made, 46 kept, 19 broken and 208 lapsed. These event counts are not a complete lifecycle reconciliation; do not infer the remainder is a bug. Add a closing ledger distinguishing still-open, end-of-games cancellation, death, expiry and success, then tune acceptance toward promises that can actually be attempted.

## 6. Arenas: robustness and complexity

There are **45 authored arenas plus procedural generation**. Expanding the roster is less urgent than ensuring each arena's rules produce different decisions.

Shared upgrades:

1. **Map reachability under change.** After closures, severed routes, tides or hazards, validate reachable shelter/water or an intentionally signalled no-escape state. A sealed level must not still allow trading.
2. **Precise place identity.** Zone + level + traversal state for contact; explicit propagation rules for area hazards. A flood may hit the lower level while smoke rises.
3. **Stable site projects.** Shelters, barricades, traps and hazard mitigation belong to sites. Allow allies or scavengers to finish abandoned work with permission/ownership consequences.
4. **Hazard chains with counterplay.** Warning → source → growth → mitigation → impact → aftermath. The existing forecast system is a foundation; reuse it for authored signatures rather than maintaining unrelated warning semantics.
5. **Interactions with limits.** Rain quenches fire but increases flood risk; a burning canopy removes cover and creates smoke; a collapsed bridge changes supply routes. Cap cascades and retain responsibility through the chain.
6. **Opportunity after damage.** Receding floods expose salvage, burnt ground reveals a cache, machinery shutdown opens a passage. Hazards should change incentives as well as health.
7. **Configuration coverage.** The main sweep covers 184 arena/config cells, but its four configs do not constitute a deliberate 16-district balance study. Add targeted expanded-field, campaign and intervention scenarios.
8. **Procedural coherence.** Validate combinations of biome, law, water, route type and signature. Incompatible combinations should be rejected or rewritten before the Games start, not explained away after impossible events.

Arena-specific expansion briefs (proposals for additional branches, not claims these arenas currently lack hazards):

| Arena | New decision chain | Possible lethal branch | Counterplay / lasting result |
|---|---|---|---|
| Clockwork Island | A damaged regulator shifts the next sector's strike; repair, exploit or broadcast it. | Being caught in the newly timed mechanism. | Verify the pattern, repair at a time cost, warn an ally; permanent schedule change. |
| Frozen Wasteland | A thawed refuge becomes a trap when water refreezes overnight. | Entrapment followed by cold injury or drowning under ice. | Drainage, dry clothing, buddy extraction; shelter becomes unusable. |
| Concrete Jungle | A rooftop water tank fractures above an occupied building. | Collapse, fall or a flooded basement. | Shore the supports, evacuate or divert water into a contested supply point. |
| Toxic Swamps | Wind reversal carries gas into a previously safe camp. | Toxic exposure in a low pocket. | Elevation, wind reading, relocation; abandoned equipment becomes risky salvage. |
| Solar Desert | A mirage lure draws pursuers away from stored water during peak heat. | Heatstroke after overcommitment. | Travel window, verified landmarks, cached water; reputational blame for false guidance. |
| Ashfall Basin | Ash plugs an improvised shelter vent during sleep. | Asphyxiation. | Vent inspection and watch rotation; warmth trades against ventilation. |
| Shattered Archipelago | A tethered supply raft breaks loose in a shifting channel. | Drowning during an overloaded retrieval. | Cut the load, share a line, abandon the prize; downstream cache changes hands. |
| Dead Coral Reef | A safe-looking shelf isolates two tributes as the tide turns. | Entrapment or an exhausted swim. | Tide knowledge, shared flotation or an escape bargain. |
| The Vault | A pressure-lock offers a shortcut but requires somebody to control it. | Machinery/pressure failure during crossing. | Trust a partner, jam the mechanism or take the longer route. |
| The Warren | A contested dig opens an airflow path and destabilizes a support. | Collapse or loss of breathable air. | Shoring and vent routing; maps and ownership of the tunnel change. |
| Perpetual Eclipse Forest | A false light mimics a rescue signal. | Ambush or a fall while following it. | Signal authentication, paired travel, observing from cover. |
| The Spore Fields | A harvest window is safe only before a dispersal pulse. | Inhalation injury after staying for one more bundle. | Mask maintenance, forecast timing, sharing verified warnings. |

## 7. More ways to die

The current cause taxonomy already includes combat, bleeding, infection/sepsis, poison, dehydration, starvation, cold, heatstroke, burns, drowning, falls, collapse, machinery, traps, asphyxiation and mutts. Merely adding these labels again would not add depth.

“Universal” should mean portable across compatible arenas, not possible on physically impossible terrain. Every candidate needs prerequisite tags, a warning or inferable risk, an avoidance option, structured attribution and at least one nonfatal outcome.

| Additional universal chain | Preconditions and choice | Failure outcome / evidence to preserve |
|---|---|---|
| Overloaded escape | Tribute chooses loot over agility during a pursuit or unstable crossing. | Fall or failed escape; record load, pursuer and discarded items. |
| Rescue line failure | A stranded person, suitable anchor and attempted extraction. | Rescuer or rescued person falls/drowns; distinguish bad anchor, excess load and deliberate cutting. |
| Shelter ventilation failure | Heat source inside enclosed shelter and poor airflow. | Smoke/asphyxiation; watch duty and vent work can prevent it. |
| Wet recovery trap | A soaked tribute sleeps without adequate drying/warmth. | Cold exposure despite apparently safe shelter. |
| Delayed contaminated meal | Shared batch, uncertain provenance and a choice to eat or test/discard. | Poison or illness; trace the batch and warn other recipients. Requires B14 first. |
| Failed retreat while wounded | Severe mobility injury plus pursuit and no safe route. | Collapse/exhaustion or capture followed by combat; aid can change the outcome. |
| Overexerted rescue | A depleted tribute spends its last reserves carrying someone. | Shock/exhaustion; staged rest or a shared carry avoids it. |
| Unstable improvised barricade | Rushed construction loaded beyond its capacity. | Collapse during defence; inspection or reinforcement changes risk. |
| Trap salvage accident | Scavenger dismantles an armed trap for supplies. | Trap injury and possible death; identification and disarming skill matter. |
| Shared-water outbreak | Several tributes consume one suspect source over time. | Delayed illness with a visible cluster; boiling, quarantine or source repair interrupts it. |
| Fire blocks the retreat | A deliberate burn intersects a planned escape route. | Burns/smoke or forced combat; retain both fire author and immediate killer. |
| Unsafe pursuit across levels | Chaser follows a quarry into an unverified descent. | Fall or separation and exposure; abandon pursuit or secure the descent. |

Keep overall lethality stable while adding diversity: substitute some existing generic resolutions with these chains rather than stacking twelve new independent death rolls per cycle. The 1,600-run sweep already averages 10.3 days with 32.0% of entrants dying in the bloodbath.

## 8. More events, universal and arena-specific

**Selection comes first:** B15 means additional conditional content can be undermined by the fallback path. An event may be rare without being allowed to ignore its prerequisites.

Universal nonfatal or branching additions:

- A contested cache with a verifiable owner mark: return, barter, steal or frame someone.
- An injured enemy offering route information: help, verify, exploit or refuse.
- A shared repair project where one participant quietly stops contributing.
- A ration inspection uncovering an innocent mistake or actual hoarding.
- A rescue signal that is genuine, outdated or deliberately forged.
- A corpse carrying an undelivered message or medicine for someone still alive.
- A temporary safe passage agreed under witnesses, with a clear expiry.
- An ally admitting they lost a vital item and asking the group to turn back.
- A sponsor package caught between rival groups, where reaching it is safer than carrying it away.
- A public accusation with incomplete evidence; a later event can vindicate the accused.
- A ceasefire to escape a shared hazard, ending with gratitude, debt or ambush.
- An opportunity to destroy useful infrastructure to deny it to pursuers.
- A quiet shared meal after a rescue, with measurable trust and no forced betrayal.
- A return to an abandoned camp that another tribute has repaired or stripped.
- A bluff that works once but becomes less credible when repeated to the same witnesses.
- A memorial/token transfer that changes a survivor's objective without inventing kinship.

For each arena brief in section 6, author at least three outcomes: successful adaptation, costly survival and lethal failure. Add a follow-up one or two cycles later that reads the actual result. The minimum useful event package is not three synonyms for a death: it is setup, choice, consequence and a remembered result.

Content metadata should include stable ID, eligible terrains/levels, minimum phase, involved roles, required items/state, cooldown, once-only rule, causal parent and outcome tags. Test the predicates with both eligible and ineligible fixtures. Measure repetition by semantic outcome as well as event ID; twenty differently worded slips are still twenty slips.

## 9. Trait, archetype and skill balance

The current census contains **184 trait definitions (153 rollable), 36 archetypes, 398 run achievements and 22 meta achievements**. Large numbers are not proof of variety, but neither is this a small unfinished roster.

The 1,600-run metrics sweep covered all 184 arena/config cells and all 36 archetypes exceeded 500 entrants. All regression guards passed. **Twelve design indicators still missed their goals.** These are current measured outputs of the existing harness; B09 means individual co-winners are undercounted, so treat the exact rates as provisional for tuning.

| Indicator | Measured | Existing design goal / interpretation |
|---|---:|---|
| Best/worst archetype win ratio | 3.24× | ≤2.3× |
| Career archetype win rate | 9.06%, 1,778 entrants | Best archetype ≤8% |
| Confessor win rate | 2.79%, 501 entrants | Worst archetype ≥3.5% |
| Zealot win rate | 3.07%, 783 entrants | Below the same floor |
| Broker win rate | 3.28%, 1,005 entrants | Below the same floor |
| Career share of recorded winners | 51.0% | ≤45% |
| Training scores ≥9 | 23.5% | 12–18% |
| Stranger final-two standoffs | 35.4% | ≤30% |
| Time at sanity floor | 19.4% | ≤15% |
| Zero-kill winners | 7.8% | ≤6%; preserve a viable nonviolent route |
| Rarest stance | Scavenging 1.3% | ≥1.5% |
| Typical duration | 10.33 days | 10.5–12 |

Five signatures miss the intended 35% rate despite clearing the 29% guard: Cartographer 32.6%, Bellwether 32.3%, Courier 31.4%, Captor 29.8%, Broker 29.3%. Quiet Professional is now 38.9%; the old audit's broken-signature finding should not be repeated as current.

**Recommended tuning order:**

1. Correct co-winner counting and run controlled samples with every district eligible. Current district shares mix fields of different sizes; they are not equal-exposure win probabilities.
2. Diagnose losses by phase, arena, district, age and loadout. A weak archetype may be failing before its signature has an opportunity, rather than needing a larger signature bonus.
3. Improve Broker's reliable negotiating opportunities and Confessor's usable social leverage. Protect against a social role being valuable only when everyone nearby is already friendly. Give Zealot an intentional disengagement condition rather than a flat health buff.
4. Reduce compounded Career advantages selectively: starting attributes, equipment, training, alliance formation and sponsors should not each independently assume the others provide no advantage. Preserve the intended dangerous opening.
5. Improve low-use stances through opportunities and consequences. Current share is Evasive 36.2%, Aggressive 26.1%, Defensive 14.0%; the remaining nine share 23.7%. Do not force equal use, but explain why Patrolling, Tending or Scavenging would be chosen.
6. Tune signature eligibility before forcing a higher random firing chance. Broker at 29.3% has very little margin above its guard.

**Trait caution:** the full measured reaping-trait range is Hydrophilic 9.14% (n=514) to Fleet 2.10% (n=238), or 4.35×. Only 27 of 155 observed starting-trait rows clear 500 entrants. Some traits can be assigned directly even if not in the rollable pool. Traits are correlated with district and archetype, and earned traits are survival-selected; these are not isolated treatment effects. Do not nerf “Outlived The Pack” because its holders win often.

Use matched casts and a controlled trait intervention with labelled RNG streams, so changing a trait does not merely shift the entire random draw sequence. Report confidence intervals, phase survival, encounters, resource access and signature opportunities. Summing the magnitudes of unrelated modifiers (hours, probabilities, combat points) is not a defensible common power scale.

## 10. Replayability and shallow features

The main risk of staleness is repeated *shapes*: opening slaughter, scattered survival, familiar convergence, generic final summary. More nouns alone will not change that.

| Existing area | Next layer of depth | A concrete success criterion |
|---|---|---|
| Run highlights | Evidence-backed, history-aware selection with category diversity | No contradictory summary; avoid selecting three variations of the same story. |
| Action budgets | Site-based jobs, transferable labour and interruption outcomes | A player can explain what a tribute sacrificed to finish a project. |
| Promises | Actual delivery/rescue contracts and end-state reconciliation | Every promise ends in a defined state with a reason. |
| Hazard forecasts | Routes, information sharing and collective mitigation | A forecast changes at least one plan, not just a log line. |
| Alliance roles | Rationing, watch rotation and rescue costs | Removing a role changes feasible group behaviour. |
| Sponsor intervention | Delivery uncertainty, rival interception and reputation effects | Help can alter a route or relationship as well as a health bar. |
| Side markets | Explicit settlement receipts and event evidence | Players can see why a bet won/lost, including dual victory and same-day elimination ties. |
| Legendary equipment | Ownership history, repairs and sacrifice decisions | The weapon's story survives the first owner's death. |
| Replay | Phase checkpoints and trustworthy partial reconstruction | Historical panels never display final-state facts as historical truth. |
| Campaign | Optional bounded consequences from prior Games | Repeated wins do not create an irreversible rich-get-richer loop. |
| Procedural maps | Coherent rule combinations and distinct resource economies | Different maps produce different journeys, not just different labels. |
| Achievements | New behaviour discovery and transparent near misses | Unlocked cards teach a mechanic instead of only celebrating a threshold. |

Additional replay modes:

- **Versioned daily challenge:** same seed, rules, content version and campaign mode for every participant; interventions either fixed or disallowed for the comparable score.
- **Scenario starts:** separated allies, a damaged crossing, a contested medical cache, asymmetric information. These should exercise existing mechanics and remain separate from the standard balance baseline.
- **Counterfactual replay:** branch from a checkpoint after changing one decision or intervention; label it as an alternate run and never overwrite the original archive.
- **Optional focus mode:** follow one tribute's knowledge and gradually reveal the rest, while preserving full spectator mode.
- **Rotating constraints:** rescue-focused, scarcity-focused, exploration-focused or diplomacy-focused goals, with multiple viable solutions.
- **Season variety controls:** reduce recently overused event chains within an explicitly saved season state. Standard seeded mode must remain independent of hidden local history.
- **Different endgame incentives:** a defensible resource point, a moving extraction promise or a negotiable safe corridor. Vary the reason to converge, not just the final location.

Use per-run semantic-event coverage, repeated story-sequence frequency, player skip/expand behaviour if collected with consent, and strategy viability across arenas. A long run is not automatically a better run.

## 11. Achievements and names to add

### Existing achievement health

The 500-run check evaluated all 398 predicates without error. It found **32 never unlocked in this sample**, **11 unlocking in at least 60% of runs**, and **11 rarity labels inconsistent with the measured rate**. It reported no duplicate predicates or identical observed unlock sets. B03 nevertheless proves two entries have the same advertised condition but different implementations; syntactic and sample-based checks do not catch semantic duplication reliably.

“Never observed” does not mean impossible. Add deterministic reachability fixtures for `every-persona`, `the-carpenter`, `a7-held-the-crossing`, `a7-scored-twelve`, `a7-mercy-on-the-victor`, `a8-off-the-floor-twice`, `a8-every-site` and the other unobserved entries before changing thresholds. `a8-bought-nothing` firing in 100% of headless runs mostly reflects a harness that does not spend player coins, not a measured human achievement rate.

### Twenty-four achievement and verification candidates

These are proposed specifications. Check semantic overlap with the existing catalog before assigning stable IDs; several require new durable counters and must not be implemented by parsing prose.

| Candidate | Exact qualifying event / state |
|---|---|
| Wrong Floor | Cancel a promised handover because the recipient is on another level, then deliver after reaching that level. |
| Left It Standing | Another tribute completes a site project whose original builder died. |
| One Hour Short | Abandon a nearly complete project to perform a successful rescue. Define the progress threshold at job creation. |
| Three Hands, One Roof | Three distinct contributors finish one shelter. |
| Paid in Full View | A witnessed restitution restores a broken pact and the restored pact survives its next deadline. |
| Kept the Receipt | Expose a false accusation using an independently recorded transfer. |
| The Warning Travelled | A hazard warning passes through two messengers and the final recipient avoids that specific hazard. |
| A Better Route | Verify a rumour as false and lead an ally along an alternate safe path. |
| Nobody Owed the Dead | Finish with every obligation to a deceased tribute explicitly resolved or lapsed, with at least three such obligations. |
| Borrowed Tomorrow | A supply loan is repaid with a later acquired batch rather than the originally borrowed item. |
| The Cost of Carrying | Discard a valuable item to complete a successful rescue. |
| Return to Sender | Recover an intercepted delivery and deliver it to its original intended recipient. |
| Witnesses Disagree | Two named witnesses report conflicting accounts and a third source settles the claim. |
| The Vote Held | A contested leadership decision is honoured by its losing candidate through the next crisis. |
| The Third Way | A threatened alliance split is avoided through a concrete renegotiated concession. |
| After the Fire | A tribute survives a hazard, returns and benefits from its changed terrain. |
| The Long Way Paid | Refuse a dangerous shortcut and reach the objective while the shortcut closes. |
| Out of Sequence | Correctly adapt to an altered arena schedule before its first unexpected strike. |
| Signal Confirmed | Verify a rescue signal before approaching and complete the rescue. |
| Shared Escape | Temporary enemies cooperate to survive one hazard and honour the agreed truce afterward. |
| The Weapon Came Back | Recover the same uniquely identified weapon after two intervening owners. |
| A Quiet Promise | Keep a difficult promise without a sponsor/publicity reward being granted for it. |
| Both Names in Gold | Archive a dual win consistently in every supported winner ledger; this may be a migration/repair milestone rather than a player card. |
| Another Kind of Year | Across a career, experience distinct endgame mechanisms, counting typed endings rather than arena names. |

Prefer the first 8–12 strongest candidates per release, with trigger fixtures, near-miss text and migration behaviour. Do not implement all 24 merely to increase the count.

### Names: strictly no surnames

The current pools contain **4,238 entries: 3,829 district/gender entries and 409 neutral entries**. These are pool entries, not a claim of 4,238 globally unique strings. The check reports 288 names appearing in more than one pool, none in more than two; initial spread is 4.0:1. There are 204 mentors, with each district pool at least 12 deep.

Keep a **single given-name field**. No surname pool, surname generator, automatic surname suffix, surname toggle or hidden surname metadata. Epithets, if retained, remain separate earned descriptors. Never invent a surname to resolve duplicate display names; use district badges and internal IDs.

The candidate list below is screened case-insensitively against the current district and neutral tribute-name pools and contains no spaces, apostrophes or hyphens. It is a review pool, not a finished district allocation. Some similarly shaped candidates should not share a district pool or the same cast. Place names by sound and district theme, retain neutral options, and run the existing no-duplicate/cross-pool checks after allocation. Mentor names need their own deduplication pass.

| Candidate group | Given names |
|---|---|
| 1 | Auvin, Auvia, Orveth, Orvia, Zirel, Ziria, Uvel, Uvela, Jaspen, Jaspia, Velcor, Velca |
| 2 | Zorren, Zorra, Uldin, Uldra, Ivrik, Ivra, Jexen, Jexa, Uvren, Uvra, Elrix, Elra |
| 3 | Osvin, Osvia, Uvoss, Uvessa, Jorven, Jorva, Nurek, Nurea, Ivane, Ivana, Edris, Edria |
| 4 | Udrin, Udria, Joril, Jorila, Envek, Enva, Ulra, Isven, Isva, Jovik, Jovia, Umren |
| 5 | Umra, Elnor, Elnora, Izren, Izra, Jarev, Jareva, Unvek, Unva, Erven, Erva, Ilven |
| 6 | Ilva, Jovren, Jovra, Urevin, Ureva, Eshrin, Eshra, Iskel, Iska, Juvin, Juvia, Uldren |
| 7 | Evern, Evra, Invek, Inva, Joreth, Joretha, Ulven, Edrik, Edrika, Izvek, Izva, Jasken |
| 8 | Jaska, Uvrel, Uvrela, Elven, Elvia, Isren, Isra, Jurek, Jurea, Uvrenna, Ulrena, Evarn |

Beyond raw additions, improve selection: suppress recent repeat names within an optional saved season, avoid confusing near-homophones in one cast, balance name length and initials, and make the selection deterministic from the complete run manifest. Do not silently introduce history dependence into ordinary seed replay.

## 12. More traits, skills and archetypes

Add only after fixing existing legal-action and opportunity problems. Each new trait should change an understandable choice or tradeoff, not introduce an invisible percentage with no feedback.

### Sixteen trait proposals

These are behaviour specifications, not unmeasured balance numbers. Check names and semantic overlap before implementation.

| Trait concept | Benefit / behaviour | Cost or boundary |
|---|---|---|
| Batch Keeper | Preserves and selects food by batch freshness. | Extra inspection time; cannot make spoiled food safe. |
| Tests the Knot | Reduces avoidable anchor failures by inspecting rope work. | Slower urgent crossings. |
| Finishes the Frame | More likely to return to an unfinished site job. | Can overcommit to a threatened location. |
| Clear Terms | Negotiates precise deliverables and deadlines. | Slower agreement formation. |
| Keeps the Route | Retains a verified escape plan. | Less willing to chase a sudden opportunity. |
| Quiet Credit | Repays help without seeking public recognition. | Lower sponsor exposure from those actions. |
| Shared Tools | Offers equipment to improve a joint project. | Temporarily gives up personal access. |
| Checks the Batch | Tests suspect food/water before sharing. | Time and supplies spent on false alarms. |
| Breaks the Chase | Disengages when pursuit crosses a known risk boundary. | Loses some finishing opportunities. |
| Holds the Line Open | Waits for the last ally at a closing passage. | Risks entrapment and delayed escape. |
| Doubts the Signal | Verifies unfamiliar signals. | May arrive late at a genuine rescue. |
| Repairs Before Rest | Prioritizes crucial equipment maintenance. | Fatigue can worsen if the habit is unchecked. |
| Won't Leave the Work | Defends a valuable site investment. | Predictable location and sunk-cost mistakes. |
| Names the Witness | Seeks witnesses for exchanges. | Makes secret cooperation harder. |
| Shares the Warning | Passes verified danger information beyond the current alliance. | Reveals knowledge or location to rivals. |
| Carries the Last Load | Volunteers for the final evacuation trip. | Higher exposure and encumbrance. |

Several should begin as learned behavioural tendencies rather than permanent reaping bonuses. Avoid awarding them for one random success; require repeated choices and define how contrary experience weakens them.

### Skills

Existing proficiencies already cover much of the useful space. Prefer specialization under them:

- **Rigging** under climbing/crafting: anchors, hauling and rescue lines.
- **Preservation** under forage/crafting: drying, sealed storage and batch handling.
- **Triage** under medicine: prioritizing stabilization under time and supply constraints.
- **Verification** under readingPeople/tracking: checking messages, tracks and contradictory testimony.
- **Engineering** under carpentry: structural load, venting and mitigation projects.
- **Coordination** under oratory/persuasion: allocating cooperative work and managing handoffs.

Only promote a specialization to a separate proficiency if it has multiple common practice opportunities, multiple consequential uses, an identifiable counterplay and visible progression. One rare event and one achievement do not justify a new skill bar. Training should credit a meaningful attempt, not require already mastering the skill to reach its only training opportunity.

### Four archetype candidates

| Archetype | Distinct plan | Signature and balancing constraint |
|---|---|---|
| The Rigger | Connects separated allies and secures risky crossings. | Completes a rescue or haul using a prepared anchor; solo utility through safer traversal must exist. |
| The Arbitrator | Keeps contested cooperation possible through evidence and terms. | Resolves a real dispute with an enforceable concession; must not duplicate Broker's trading loop. |
| The Reclaimer | Returns to changed or abandoned sites for salvage and repairs. | Restores a useful site after a hazard; distinguish from Scavenger by improving infrastructure, not merely taking loot. |
| The Evacuator | Moves a vulnerable group before a known disaster. | Coordinates a timed withdrawal with explicit cost; distinguish from Courier by people, route and readiness rather than package delivery. |

Gate each on demonstrated behavioural distinction, signature opportunities before death, survival by phase, resource use and win rates across environments. Start with two, not all four. Do not give a new archetype a flat survival subsidy to conceal that its core action rarely becomes legal.

## 13. Recommended implementation order

| Batch | Work | Exit criteria |
|---|---|---|
| 1 — Trust the result | B01–B09: phase counts, semantic achievement conflict, winners, summary evidence and accounting. | The same run has the same truthful outcome in UI, export, achievements, career records and metrics. |
| 2 — Consistent mechanics | B10–B15: site jobs, nonnegative time, physical promises, delivery conservation, stack metadata, hard event eligibility. | Focused failure fixtures pass; resume preserves the result; baseline scenario and soak checks remain green. |
| 3 — Balance and readability | Corrected balance sweep, social-archetype opportunity fixes, sanity pacing, scalable text and summary links. | Report target movement with sample sizes; complete browser/phone validation rather than relying on static checks. |
| 4 — Three deep content pilots | One universal rescue chain, one alliance dispute chain, one arena environmental chain. | Each has warning/choice/consequence, a nonfatal branch, durable records and no impossible fallback. |
| 5 — Replay and catalog growth | Versioned scenarios, remaining arena briefs, selected achievements, screened names, then trait/archetype pilots. | New content demonstrably changes behaviour or stories; no surnames introduced. |

Cross-cutting release checks: deterministic seeded replay, save/resume equivalence, item and time conservation, valid winner accounting, semantic achievement uniqueness, hard event eligibility, and historical summaries supported by recorded facts. Re-run broad tests when a change touches their risk area; do not use a giant passing test roster as a substitute for the focused failure examples above.

## 14. Validation and limits

Completed on the audited checkout:

- `npm ci --ignore-scripts` succeeded.
- `npm run lint`: pass, with 17 warnings.
- `npm run build`: pass; bundle sizes reported in section 3.
- Dependency audit: **0 known vulnerabilities reported** by `npm audit --audit-level=high` at execution time. This is not a complete security audit.
- Simulation soak: 400 runs, no invariant violations; 121 typed beats each observed at least once.
- Metrics: 1,600 runs, all 184 arena/config cells covered, all regression guards hold; 12 design goals unmet.
- Achievements: 500 complete runs, all predicates evaluated; 32 unobserved and 11 near-automatic.
- Storage, declared/undeclared balance knobs, arena validation/layout, names, flavour, unnamed prose, predicates, references, zone features, decisions, cause codes, UI affordances and scenarios: pass. Scenario suite: 27/27.
- Dedicated current-summary probe: 120 completed games plus focused fixtures for work, vertical delivery, batch freshness, event eligibility and achievement phase counts.

The `tsx` CLI initially failed because this environment disallowed its temporary IPC socket. The TypeScript checks were then executed through `node --import tsx <script>`, which runs the same scripts without that CLI socket. Those initial environment errors are not repository test failures.

**Browser limit:** the UI harness could not launch because its expected Chromium executable was absent. Vite served successfully when bound to `127.0.0.1`, but no browser visual/accessibility pass is claimed. UI findings here are source/static-check findings and proposed acceptance tests, not verified screenshots. Production browser behaviour, historical imported saves, extensive player-intervention paths and long-running campaign balance still need targeted validation.

The audit intentionally leaves production code unchanged. The recommendations can be implemented in the batches above without introducing surnames or discarding the game's existing systems.


## Appendix: reproducible probe sources

Place these files under `scripts/` in a checkout of the audited commit after installing dependencies. Run `node --import tsx scripts/audit-probe.ts` and `node --import tsx scripts/audit-micro.ts`. The first sweeps 120 Games; the second exercises targeted boundaries. They report observed behaviour, including defects, rather than asserting the proposed corrected behaviour. They do not modify production files or remote state.

### audit-probe.ts

```ts
import {Simulator} from '../src/engine/simulator';
import {initialRunState} from './runInit';
import {ARENAS,DEFAULT_GAME_CONFIG} from '../src/data/constants';
import {runNotables} from '../src/utils/notables';
import {EMPTY_PANEM} from '../src/utils/panemStorage';
import {chronicleMarkdown} from '../src/utils/chronicle';
import {TRAIT_DEFS} from '../src/data/traits';
import {ARCHETYPES} from '../src/data/archetypes';
import {ACHIEVEMENTS,META_ACHIEVEMENTS} from '../src/data/achievements';
import {DISTRICT_NAMES,NEUTRAL_NAMES} from '../src/data/names';
import {ARENA_FLAVOR,UNIVERSAL_EVENTS} from '../src/data/arenaFlavor';
import {ARENA_EVENT_PACKS} from '../src/data/arenaEventPacks';
const summary:any={runs:0,bloodbathDeaths:0,dayZeroDeaths:0,falseQuietHighlights:0,peakPacks5:0,finalPacks5:0,vengeanceSwornRuns:0,vengeancePaidRuns:0,dualWins:0,examples:[]};
for(let i=0;i<120;i++){
 const sim=new Simulator(initialRunState({seed:`audit-current-${i}`,arenaId:ARENAS[i%ARENAS.length].id,config:DEFAULT_GAME_CONFIG}));
 let peak=0;sim.observe(s=>{peak=Math.max(peak,...Object.values(s.alliances??{}).map(a=>a.memberIds.length));});
 let steps=0;while(!sim.isFinished()&&steps++<250)sim.advance();
 const s=sim.getState();const bb=s.tributes.filter(t=>t.diedInBloodbath).length;const zero=s.tributes.filter(t=>t.status==='dead'&&t.dayOfDeath===0).length;
 const notes=runNotables(s,EMPTY_PANEM).map(n=>n.text);summary.runs++;summary.bloodbathDeaths+=bb;summary.dayZeroDeaths+=zero;
 if(bb>2&&notes.some(n=>n.includes('nobody died at the Cornucopia'))){summary.falseQuietHighlights++;if(summary.examples.length<3)summary.examples.push({seed:s.seed,bb,days:[...new Set(s.tributes.filter(t=>t.diedInBloodbath).map(t=>t.dayOfDeath))],notes});}
 if(peak>=5)summary.peakPacks5++;if(Object.values(s.alliances??{}).some(a=>a.memberIds.length>=5))summary.finalPacks5++;
 if(s.log.some(l=>l.type==='vengeance-sworn'))summary.vengeanceSwornRuns++;
 if(s.log.some(l=>l.type==='vengeance-paid'))summary.vengeancePaidRuns++;
 if((s.victorIds?.length??0)>1){summary.dualWins++;if(!summary.dualExample)summary.dualExample={seed:s.seed,winners:s.tributes.filter(t=>t.status==='alive').map(t=>t.name),notes,export:chronicleMarkdown(s).split('\n').slice(0,8)};}
}
console.log(JSON.stringify(summary,null,2));
console.log('CENSUS',JSON.stringify({traits:Object.keys(TRAIT_DEFS).length,rollable:Object.values(TRAIT_DEFS).filter(t=>!t.earned).length,archetypes:Object.keys(ARCHETYPES).length,achievements:ACHIEVEMENTS.length,meta:META_ACHIEVEMENTS.length,arenas:ARENAS.length,names:Object.values(DISTRICT_NAMES).flatMap(g=>Object.values(g).flat()).length,neutral:Object.values(NEUTRAL_NAMES).flat().length,universalEvents:UNIVERSAL_EVENTS.length,arenaPacks:Object.keys(ARENA_EVENT_PACKS).length,archetypeNames:Object.values(ARCHETYPES).map(a=>a.name),arenasList:ARENAS.map(a=>({id:a.id,name:a.name}))},null,2));
```

### audit-micro.ts

```ts
import {initialRunState} from './runInit';
import {ARENAS,DEFAULT_GAME_CONFIG,ITEMS} from '../src/data/constants';
import {createContext} from '../src/engine/context';
import {RNG} from '../src/utils/rng';
import {work} from '../src/engine/actionBudget';
import {tickObligations} from '../src/engine/obligations';
import {samePlace} from '../src/engine/verticality';
import {giveItem} from '../src/engine/items';
import {chronicleMarkdown} from '../src/utils/chronicle';
const s=initialRunState({seed:'audit-micro',arenaId:ARENAS[0].id,config:DEFAULT_GAME_CONFIG});const [a,b]=s.tributes;
a.hoursLeft=2;work(a,'shelter',3);a.zone='Another place';a.hoursLeft=1;
console.log('cross-zone completion',work(a,'shelter',3));
a.partialWork={kind:'mitigate:burning',hoursDone:3};a.hoursLeft=1;
console.log('cheaper resumed job',{complete:work(a,'mitigate:burning',2),hoursLeft:a.hoursLeft,partialWork:a.partialWork});
s.arena.zones[0].features={...s.arena.zones[0].features,vertical:true};a.zone=b.zone=s.arena.zones[0].name;a.zoneLevel='upper';b.zoneLevel='lower';
a.inventory=[structuredClone(ITEMS.find(i=>i.type==='food')!)];b.inventory=[];b.vitals.hunger=100;b.health=100;
s.obligations=[{id:'probe',owedById:a.id,owedToId:b.id,kind:'supply',byCycle:99,status:'open'}];
console.log('samePlace',samePlace(s.arena,a,b));tickObligations(createContext(s,new RNG('probe')));
console.log('vertical supply',{status:s.obligations[0].status,recipientItems:b.inventory.map(i=>i.name)});
const food=ITEMS.find(i=>i.type==='food')!;b.inventory=[{...food,stack:1,spoilage:1}];giveItem(b,{...food,stack:1,spoilage:9});
console.log('stack metadata',b.inventory.map(i=>({stack:i.stack,spoilage:i.spoilage})));
console.log('unfinished export',chronicleMarkdown(s).split('\n').slice(0,8));
const {pickTerrainEvent}=await import('../src/engine/encounters');
const event={id:'fixture-medical',text:'medical fixture',escapeText:'escape',cause:'fixture',requires:{carrying:'medical' as const}};
a.inventory=[];
console.log('ineligible event selected',pickTerrainEvent(createContext(s,new RNG('event')), [event], undefined,a).id);
const once={...event,id:'fixture-once',requires:undefined,oncePerRun:true};s.firedEvents=['fixture-once'];
console.log('spent event selected',pickTerrainEvent(createContext(s,new RNG('event')), [once], undefined,a).id);
const {ACHIEVEMENTS}=await import('../src/data/achievements');
const f=structuredClone(s);f.tributes.forEach((t,i)=>{t.status=i<12?'dead':'alive';t.dayOfDeath=i<12?1:undefined;t.diedInBloodbath=i<3;});
console.log('bloodbath achievements', ['bloodbath-massacre','a7-half-at-the-horn'].map(id=>[id,ACHIEVEMENTS.find(a=>a.id===id)!.test(f)]));
```
