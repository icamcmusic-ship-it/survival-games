# Survival Games — current-code audit and expansion plan

Repository: [icamcmusic-ship-it/survival-games](https://github.com/icamcmusic-ship-it/survival-games). Audited revision: [`ca05f08b85a95529cc336cc5c7293dab0932854a`](https://github.com/icamcmusic-ship-it/survival-games/tree/ca05f08b85a95529cc336cc5c7293dab0932854a), the merged AUDIT-9 batch 4 revision. Audit date: 21 September 2026.

This is an audit and implementation backlog, not an implementation release. Production source and the remote repository were not changed. A local diagnostic script was added to reproduce findings; its full source is included at the end. Findings apply to this revision, not to earlier audit reports.

## 1. What matters most

The game has considerable breadth: **45 authored arenas plus procedural generation, 36 archetypes, 184 trait definitions (153 not marked earned), 396 run achievements and 22 meta achievements**. Tribute pools contain **3,829 district/gender entries and 409 neutral entries**, not necessarily that many distinct names. It also already has action budgets, obligations, trust, rumours, verticality, persistent hazards, campaign continuity, rewind, save slots and decision explanations.

The highest-value work is to make these systems agree about what happened. The latest three content pilots expose the same integration problem in several forms: a scene reports success without a corresponding physical result, remote people participate in a supposedly local interaction, or a later sentence asserts something the state never recorded.

Recommended order:

1. Repair data-loss and malformed-input failures.
2. Make rescue, movement, inventory and alliance interactions obey common physical rules.
3. Make histories, explanations and sharing report precisely what they know.
4. Tune balance with controlled comparisons and opportunity measurements.
5. Add complete event chains, arena transformations and cooperative choices, then expand catalogs.

**Naming constraint:** retain one given-name field. No surnames, surname pools, surname toggles, surname generation, or hidden surname metadata. Disambiguate with district badges and internal IDs. Earned epithets must remain separate from the name.

## 2. Evidence and limits

### Validation completed on this checkout

| Check | Result |
|---|---|
| Dependency installation | `npm ci --ignore-scripts` succeeded. |
| TypeScript and ESLint | Passed; 17 warnings, mostly React hook/ref/immutability warnings. These are not all demonstrated user-facing defects. |
| Production build | Passed. Main index chunk: 2,825.31 kB uncompressed / 787.91 kB gzip; engine chunk: 328.68 / 107.85 kB. |
| Simulation soak | 400 runs; no invariant violations; 129 typed beats observed. |
| Balance | 400-run baseline and 1,600-run sweep; all 184 arena/config combinations covered. All regression guards passed at 1,600; 12 design goals remained unmet. |
| Prior defect fixtures | `check-audit10`: 28/28; original scenario suite: 27/27; batch 3 passed; newest batch 4: 12/12. |
| Achievements | 396 predicates over 500 runs; no predicate exceptions, duplicate titles, identical predicate sources or identical observed unlock sets reported. |
| Other checks | Storage migrations, declared/undeclared balance knobs, arenas, arena layout, names, flavour, predicates, references, zone features and static UI affordances all passed. |
| New targeted probes | Twelve named probes reproduced the behaviors described below, despite the existing suites passing. |
| Browser UI | Could not launch: required Playwright Chromium executable is absent. No screenshot, touch, screen-reader or live visual pass is claimed. |

Scripts were run with `node --import tsx` where appropriate. No current dependency vulnerability verdict is claimed: dependency installation and successful build do not substitute for a security advisory audit. No production deployment was performed.

This review covers every requested topic, but no finite code review can certify that it found every bug. Engine boundaries and new content received targeted execution; UI findings are source-based. Campaign histories, malformed imports beyond the reproduced case, manual Gamemaker interventions, every save format and every possible trait combination remain larger test spaces.

The old audit findings were not simply copied forward. The current fixtures confirm prior repairs for winner accounting, bloodbath summaries, site-bound work, stack freshness, event eligibility and other earlier issues. The findings below concern remaining or newly introduced behavior.

## 3. Confirmed defects and concrete repair requirements

Priority: **P1** = data loss, crash or substantial simulation correctness; **P2** = misleading results, localized mechanics or usability; **P3** = maintenance. “Reproduced” means a targeted execution, not a measured natural-run frequency. Function names are stable navigation anchors within the pinned files.

### Persistence and input

**F01 — P1 — Legacy migration deletes the only saved copy if the replacement write fails. Reproduced.**

In [`utils/storage.ts`, `readStored`](https://github.com/icamcmusic-ship-it/survival-games/blob/ca05f08b85a95529cc336cc5c7293dab0932854a/src/utils/storage.ts#L199), migration calls `writeStored`, which discards the write result, and then removes the legacy key. With a backend that throws `QuotaExceededError`, the probe returned the migrated object but left **neither old nor new key**. The current session can appear fine while the next reload loses the data.

Repair: use `tryWriteStored`; remove a legacy key only after an `ok` write. Preserve the old copy on quota/unavailable results. Acceptance: read, fail write, reload, and recover the original; successful migration retires the old key exactly once.

**F02 — P1 — Shared campaign validation admits a payload that crashes the simulation. Reproduced.**

[`utils/campaignLink.ts`, `decodeCampaign`](https://github.com/icamcmusic-ship-it/survival-games/blob/ca05f08b85a95529cc336cc5c7293dab0932854a/src/utils/campaignLink.ts#L85) casts nested objects and `recentRuns` without validating their contents. An encoded `{runs:1,victors:1,recentRuns:[null]}` is accepted; advancing the resulting run throws `Cannot read properties of null (reading 'victorDistrict')` in continuity processing.

Repair: validate each nested record and array member; require finite bounded numeric fields and valid district IDs; cap payload size and collection lengths. Reject an invalid run link with a recoverable explanation. Never silently claim an exact replay after discarding its campaign. Acceptance: null members, wrong record shapes, unknown IDs, oversized arrays and valid older snapshots.

**F03 — P2 — Temporary memory storage is reported as a successful persistent save. Source-confirmed.**

The same storage module substitutes `memoryBackend()` when access to localStorage fails. `tryWriteStored()` then returns `ok` because the memory write succeeds. That conflates “available until this tab closes” with “saved for later.” Expose a persistence-capability result and a visible “temporary session—export to keep” state; do not remove the useful memory fallback.

### Tribute and rescue logic

**F04 — P1 — A clean rescue of a downed tribute has no extraction or stabilization transition. Reproduced.**

[`engine/rescueLine.ts`, successful branch](https://github.com/icamcmusic-ship-it/survival-games/blob/ca05f08b85a95529cc336cc5c7293dab0932854a/src/engine/rescueLine.ts#L333) records `clean`, charges fatigue and awards debt/regard, but changes position only for `stranding === 'below'`. For `downed`, the probe ends with **health 0 and `downed` still set**, with no safer location or stabilization marker. [`postActionUpkeep`](https://github.com/icamcmusic-ship-it/survival-games/blob/ca05f08b85a95529cc336cc5c7293dab0932854a/src/engine/phases/upkeep.ts#L51) then runs the independent downed rescue/execution clock.

Do not fix this by making every haul a full medical revival. Separate **extracted**, **stabilized** and **revived** outcomes. A successful extraction must move the person to a valid destination, remove a specific environmental threat, or explicitly improve the rescue window. A failed medical follow-up should remain possible and be narrated as a separate event. Award help counters for the action actually completed.

**F05 — P1 — Cutting a downed tribute’s rescue line cannot apply its intended damage or attribution. Reproduced.**

The `cut` branch calls `applyDamage` and `checkDeath`, but [`combat.ts`](https://github.com/icamcmusic-ship-it/survival-games/blob/ca05f08b85a95529cc336cc5c7293dab0932854a/src/engine/combat.ts#L273) deliberately rejects damage/death resolution for already-downed tributes. The probe records a cut and increments betrayal, while the victim remains downed and no new attacker attribution is written. Anchor failure against a downed victim shares this boundary problem.

Repair: route an explicit lethal/interruption event through the downed state machine, preserving its clock for ordinary status damage. Test intentional cutting, accidental fall, nonfatal rescue injury, original attacker versus cutter credit, and a cutter who subsequently dies.

**F06 — P2 — Poison berries qualify as a properly rigged rescue rope. Reproduced.**

`anchorFor` accepts **any utility or tool item**. A Rope-Handed tribute carrying only Nightlock Berries received `anchor: 'rigged'`. Matches, filters and whetstones also satisfy the broad type check by inspection.

Repair: add item capabilities such as `ropeLength`, `tensileStrength`, `anchorMaterial` and `cuttingEdge`; compose recipes from eligible items. Distinguish proper rope, lashable cloth and no usable material. Do not consume arbitrary supplies to make an otherwise impossible scene legal.

**F07 — P2 — An ineligible best volunteer prevents a healthy rescuer from trying. Reproduced.**

`tickRescueLines` ranks willingness first, then returns if that winner’s health is below `rescuerMinHealth`. In a fixture with a one-health favorite and a healthy willing alternative, 100 attempts produced no rescue. Filter capability, reach and resources before ranking; test that a valid second candidate can act and that ties do not always favor roster order.

**F08 — P1 — Downed tributes climb under their own power. Reproduced.**

[`verticality.ts`, `tickVerticality`](https://github.com/icamcmusic-ship-it/survival-games/blob/ca05f08b85a95529cc336cc5c7293dab0932854a/src/engine/verticality.ts#L82) checks `status === 'alive'`, not `isActive`. A zero-health downed tribute moved from lower to upper while carrying zero available hours and logged a successful climb. Require capability, no incompatible transit and an action budget. Recheck capability after fall damage, because a fall can down someone mid-action.

**F09 — P1 — Medical rescue and execution ignore vertical separation. Reproduced for rescue; source-confirmed for shared participant selection.**

[`downed.ts`, `tickDowned`](https://github.com/icamcmusic-ship-it/survival-games/blob/ca05f08b85a95529cc336cc5c7293dab0932854a/src/engine/downed.ts) finds helpers and hostiles using zone-name equality. A lower-level victim was revived to 22 health by an upper-level helper while `samePlace` returned false. Direct treatment/execution should require contact. Rope rescue may intentionally span levels, but needs a typed reachable connection and appropriate equipment rather than the same-zone shortcut.

### Alliances, resources and chronology

**F10 — P1 — Alliance hearings distribute a physical cache to remote members. Reproduced.**

[`allianceDispute.ts`, `tickAllianceDisputes`](https://github.com/icamcmusic-ship-it/survival-games/blob/ca05f08b85a95529cc336cc5c7293dab0932854a/src/engine/allianceDispute.ts#L84) uses all active alliance members, without checking the camp, their level or proximity. Three members in three sectors received a ration hearing and a transfer from an unattended cache. The prose places everyone around the same box.

Repair: participants must be physically present at the cache’s location and level. Remote members may have standing entitlements, but a messenger or transport action must deliver their share. Store cache location independently of the leader’s current location.

**F11 — P2 — Rationing counts inventory objects and generic item value, not usable portions or the relevant need. Reproduced for stacks; source-confirmed for selection.**

The “equal” fixture gave the first member all **four bread units in one stack**, then recorded two hungry members as passed over. `cacheValue` ignores stack quantity and includes non-provisions; allocation selects the first food or water regardless of which need is critical. An expensive utility item can suppress a food-shortage hearing. This can manufacture political grievances from an accounting mistake.

Repair: ration edible/drinkable units, contamination and freshness separately from sale value; match food to hunger and water to thirst; track issued and consumed quantities. Rotate or fairly seed remainder allocation. Acceptance: equivalent quantities packed as one stack or several produce equivalent ration entitlements.

**F12 — P2 — The new hearing ignores inventory overflow and still records the recipient as fed. Source-confirmed.**

`holdHearing` removes an item from the cache, calls `giveItem`, ignores its returned dropped items and pushes the recipient into `fedIds`. The same conservation boundary was fixed for obligations but reintroduced here. Use an atomic transfer result; preserve overflow at the actual location, and distinguish issued, retained and consumed. Test both an incoming ration dropped and an existing item displaced.

**F13 — P2 — Follow-up narration asserts histories it never checked. Reproduced.**

[`tickDisputeAftermath`](https://github.com/icamcmusic-ship-it/survival-games/blob/ca05f08b85a95529cc336cc5c7293dab0932854a/src/engine/allianceDispute.ts) said a walkout “has not gone back” after that person had rejoined the same alliance. [`tickRescueAftermath`](https://github.com/icamcmusic-ship-it/survival-games/blob/ca05f08b85a95529cc336cc5c7293dab0932854a/src/engine/rescueLine.ts#L380) said two people had stayed within arm’s reach while they occupied different sectors. Its cut branch also asserts possession of a rope without checking inventory, even when the original anchor was improvised.

Repair: distinguish remembered incident, current state and continuous historical claims. Record reunions, contact intervals, item identity and avoidance behavior if prose needs them; otherwise use wording supported by the incident alone. Acceptance: rejoined, separated, dead, betrayed-again, lost-rope and returned-to-danger variants.

**F14 — P1 — Feast phases advance the clock without advancing forecast/zone-effect lifecycle. Reproduced.**

[`processFeast`](https://github.com/icamcmusic-ship-it/survival-games/blob/ca05f08b85a95529cc336cc5c7293dab0932854a/src/engine/phases/feast.ts) includes physiological upkeep but not the forecast/effect ticks called by `processDayNight`. A flood due at cycle 6 remained pending with no effect after a feast advanced cycle 5 to 6. Existing effects likewise omit their per-cycle tick on this route. This makes the meaning of a deadline depend on which kind of phase occupied it.

Repair: define one elapsed-cycle lifecycle for forecasts, effects, deadlines and decay. Separate actions specific to a feast from world time. Define whether forecast impact precedes travel or follows it, then apply the same rule everywhere. Test imminent floods and fires for attendees and non-attendees, including repeated-feast rules.

**F15 — P2 — New major actions bypass the action-budget contract. Reproduced for rescue and climbing; source-confirmed for hearings.**

A rescuer with zero hours completes a haul; climbing also ignores hours. Hearings do not reserve participant time. Fatigue is charged for some of these actions, but fatigue and available hours are separate systems. Decide which actions are interrupts, which replace another action, and which can intentionally create time debt. Otherwise adding features makes tributes perform more work per cycle simply because more modules run.

### UI, replay and measurement

**F16 — P2 — Clipboard controls can claim success without copying. Source-confirmed.**

[`ShareButton.tsx`](https://github.com/icamcmusic-ship-it/survival-games/blob/ca05f08b85a95529cc336cc5c7293dab0932854a/src/components/ShareButton.tsx) awaits optional `navigator.clipboard?.writeText(seed)` and marks the seed copied even when the API is absent. The URL fallback ignores the boolean returned by `document.execCommand('copy')`. Use one shared copy helper that verifies success and exposes selectable text otherwise. Test unavailable, rejected, false-returning and successful paths; announce status accessibly.

**F17 — P2 — The zone dossier labels absolute resource yield as percent of original stock. Source-confirmed.**

[`ZoneDossier.tsx`](https://github.com/icamcmusic-ship-it/survival-games/blob/ca05f08b85a95529cc336cc5c7293dab0932854a/src/components/ZoneDossier.tsx) calculates `printed.resources * (1 - depletion) * 100` but displays “% of what it started with.” A zone with resources 0.4 and zero depletion shows 40% of its original stock. Display `(1 - depletion) * 100` for relative stock, or label the current figure as effective yield. Keep the historical worst figure on the same scale.

**F18 — P2 — “Why did they do that?” can explain the wrong stance. Source-confirmed.**

[`TributeModal.tsx`](https://github.com/icamcmusic-ship-it/survival-games/blob/ca05f08b85a95529cc336cc5c7293dab0932854a/src/components/TributeModal.tsx#L528) prints the actual stance with reasons from `decisionTrace.stances[0]`. [`stance.ts`](https://github.com/icamcmusic-ship-it/survival-games/blob/ca05f08b85a95529cc336cc5c7293dab0932854a/src/engine/stance.ts#L879) stores the ranking before hysteresis may retain a different stance. Show the selected stance’s reasons and an explicit “held because switching was not worth it” decision when applicable. The alternative must differ from the chosen stance.

**F19 — P2 — “Exact run” sharing still lacks a complete run manifest. Source-confirmed scope gap.**

The share payload now includes campaign state, which is a real improvement. It does not include an engine/content revision, seated veteran identities, custom cast edits or the sequence of player interventions. [`gameStore.startGame`](https://github.com/icamcmusic-ship-it/survival-games/blob/ca05f08b85a95529cc336cc5c7293dab0932854a/src/store/gameStore.ts#L1031) reads grudge-match selections separately; Hall-of-Fame relaunch also starts under the current campaign rather than passing an archived campaign. Do not promise reproduction for inputs absent from the link.

Repair: distinguish **same seed**, **same initial conditions**, **recorded playback** and **interactive branch**. Version the manifest; carry cast overrides and intervention records where supported. Archived runs with insufficient inputs should say “relaunch under current rules.” Persist replay expectations across updates without requiring old engines to remain supported forever.

**F20 — P2 — The whole-table trait verdict uses an unrelated sample-sufficiency test. Source-confirmed and observed.**

[`scripts/metrics.ts`](https://github.com/icamcmusic-ship-it/survival-games/blob/ca05f08b85a95529cc336cc5c7293dab0932854a/scripts/metrics.ts#L1449) judges the full trait spread once enough *other* traits pass the 500-entrant guard. It printed “SHORT of goal” for Ruthless versus Slow Burn at **248 and 303 entrants**, while only 27 of 155 observed reaping trait labels cleared 500. The weaker-sample full table is useful, but its verdict is stronger than its eligibility rule supports. Require adequate samples for the compared rows, report intervals and distinguish exploratory rankings from release gates.

**F21 — P3 — Documentation materially understates current CI and catalog coverage. Source-confirmed.**

README says UI testing is excluded from CI, while [`.github/workflows/ci.yml`](https://github.com/icamcmusic-ship-it/survival-games/blob/ca05f08b85a95529cc336cc5c7293dab0932854a/.github/workflows/ci.yml) has a browser UI job. Counts such as “130-odd” achievements and references to fifteen archetypes are stale. Generate a short catalog/test inventory and remove historical implementation essays from operational setup instructions. Keep past measurements dated and revision-bound.

## 4. Tribute intelligence, robustness and depth

The engine already has memory, intentions, scoring, prerequisites, stamina and action budgets. The next layer should make those systems consistently constrain one another, rather than adding another independent probability pass.

### Shared legal-action contract

Introduce a small action specification with actor IDs, required capability, origin/target location and level, resources reserved, duration, interruption policy, success criteria and typed results. Validate twice: before committing and immediately before resolution. Examples: a rescue target moved; the rope holder died; the cache emptied; a gate closed; a promise expired while crossing.

Use explicit queries: `canAct`, `canReach`, `canObserve`, `canTransfer`, `canCarry` and `canAfford`. `isActive` currently means alive and not downed; it does not by itself prove a person is not in transit or has free hands/time. Rope reach is different from medical contact; hearing a scream is different from identifying its speaker.

### Better decisions without omniscience

| Improvement | Meaningful behavior | Acceptance evidence |
|---|---|---|
| Plans with a fallback | “Get water; if blocked, use the rain catcher; if that fails, negotiate.” | Failed prerequisite selects another legal action instead of looping or silently succeeding. |
| Confidence-aware beliefs | Stale danger or resource information becomes uncertain, not immediately false. | A tribute with no sighting cannot know an enemy’s exact new level. |
| Commitment with explicit costs | Finish a shelter unless new risk outweighs sunk work and future benefit. | Explain an interruption in terms of remaining work, risk and urgency. |
| Opportunity cost | Rescue, treatment, cooking and negotiation displace travel/forage. | Reserved time plus elapsed work is conserved. |
| Recovery planning | Injured tributes seek medicine, protection and safer routes before another hunt. | Injury meaningfully changes choices, without permanent inactivity. |
| Selective risk | A desperate person may knowingly accept a bad chance for an urgent need. | Explanation distinguishes informed risk from misinformation. |
| Adaptive opponents | Remember observed feints, trap sites and broken promises. | Learning belongs to witnesses; opponents can change tactics. |
| Stable equipment identity | Track a specific blade, rope, medicine batch or token through transfers. | Ownership, durability and provenance survive save/resume. |

Add behavior metrics: impossible-action attempts, affordable-plan completion, fallback usefulness, repeated no-op cycles, wasted journeys, rescue opportunity versus attempt versus success, and resource/time conservation. These reveal failures that “event fired at least once” cannot.

Keep attributes, traits, learned proficiencies and temporary conditions distinct. Attributes represent broad ability; traits bias decisions or tradeoffs; practice improves proficiencies; injuries/illness alter current capability. Avoid expressing the same advantage in all four layers without knowing the combined effect.

## 5. Relationships and alliances

The game already models more than a single friendship score. Preserve regard, trust, fear, respect, debts, obligations, pacts and rumours; give each a distinct job in decisions and visible explanations.

1. **Contextual trust:** separate trust in repayment, combat support and information. A liar can still be a reliable shield; a kind ally can be a poor lookout. Begin with a few domains, not a dense matrix of unused numbers.
2. **Shared decisions:** record a proposal, eligible voters, positions, result and concession. A ration dispute should respond to actual quantities and individual needs, not only leader style and a random split.
3. **Leadership succession:** illness, absence, death and loss of confidence trigger a named successor or split. Leadership must affect routes and priorities rather than only a label.
4. **Bounded obligations:** define destination, amount, quality, deadline and exceptions. “Bring food” should not be satisfied by unwanted water or a delivery that is immediately dropped. Rescue priority should alter rescuer selection.
5. **Witnessed events:** distinguish private betrayal, suspected betrayal and proven betrayal. Knowledge travels through witnesses and messages. Do not give every tribute the full social graph.
6. **Negotiated conflict:** restitution, shared risk, exchanged hostages only where existing captivity rules support it, and temporary neutral exchanges. Breakup is one outcome, not the only outcome.
7. **Fair scarcity:** ration ledgers, protected minimum reserves, hoarding discoveries and emergency exceptions. A contributed stack is multiple units; medicine is not bread.
8. **Real reunions:** former allies can rejoin under changed terms, remain enemies, or cooperate once. Preserve historical membership and actual reunion events.
9. **Coalitions with limits:** common enemies can motivate cooperation without merging all factions. Track target, expiry and what participants promised.
10. **Earned endgame relationships:** surviving enemies should often have prior sightings, trades, injuries or negotiations. Seed encounters through routes and contested resources rather than force a backstory at the finale.

UI: an alliance dossier should show current members, location, camp stock, leader, roles, open commitments, recent fulfilled/broken terms and reasons for the last split. A relationship edge should offer a short evidence trail, not merely a number.

## 6. Arena systems and more complexity

### Shared arena upgrades

- **Topology that matters:** directed or conditionally passable edges, capacity, traversal time, level, noise and load. Validate connectivity for the capabilities actually present, not just an abstract undirected graph.
- **Persistent projects:** anchor points, firebreaks, drains, shelters, barriers and repaired machinery should belong to the site. Another tribute can discover, finish, damage or appropriate them. Site ID and target hazard ID matter as much as project kind.
- **Forecasts with actionable lead time:** warning, local knowledge, preparation, impact and aftermath. A log line immediately followed by resolution in the same function is not an intervention window. In auto-simulation it can still explain the decision; in interactive mode a promised choice needs a real pause.
- **Physical hazard propagation:** downstream contamination, wind-driven smoke, upstream dam failure, load-bearing connections and noise-triggered threats. Cap chain reactions and prevent iteration order from giving newly created effects an accidental extra tick.
- **Recovery and opportunity:** a receded flood exposes salvage; a shutdown opens a route; a burn creates visibility and later regrowth. Avoid permanent punishment accumulation making all late games equivalent.
- **Arena identity metrics:** track not just which unique text fired but which routes, resources, alliances and deaths depended on that arena’s rules.
- **Procedural compatibility:** generate from capability tags and tested combinations. “Water hazard” requires water; “vertical rescue” requires height and access; a no-sponsor law must apply to every delivery path.

### Arena-by-arena expansion briefs

These are proposed chains/extensions to each arena’s existing identity. They are not claims that none of the ingredients already exist. Reuse current primitives and event packs; distinguish the new choice and remembered aftermath from existing one-shot prose. Each row needs a warning, avoidance/mitigation, nonfatal result and durable cause record.

| Arena ID / arena | Event and consequential choice | Additional lethal branch / lasting result |
|---|---|---|
| `clockwork` — Clockwork Island | Tributes compare observed sector timings; a damaged indicator creates conflicting schedules. Verify at a cost or trust a messenger. | A closing timed gate traps a late crosser; repaired timing knowledge becomes tradable evidence. |
| `frozen` — Frozen Wasteland | Two groups share a windbreak while a thaw weakens its roof. Reinforce, vent, or move. | Roof burial or exposure during evacuation; surviving materials seed a better shelter. |
| `concrete` — Concrete Jungle | A leaking rooftop tank changes load on a damaged stairwell. Drain it or preserve water. | Structural failure cuts the vertical route; water becomes available below. |
| `toxic` — Toxic Swamps | A purifier’s upstream intake drifts into a contaminated pocket. Test, move intake, or conceal the finding. | Shared-batch poisoning with traceable recipients and a later warning chain. |
| `solar` — Solar Desert | A reflective salvage shield provides shade but advertises location. Trade concealment for safe travel. | Heat collapse on an exposed crossing; opponents may seize the shield. |
| `ashfall` — Ashfall Basin | A shelter intake clogs during ashfall. Clear it from outside or ration breathable shelter time. | Suffocation in a poorly ventilated refuge; cleared ash reveals cached supplies. |
| `tempest` — Tempest Reach | A storm loosens an anchor holding a supply platform. Unload, brace or abandon it. | Platform breakaway and drowning; drifted supplies wash into another sector. |
| `saltflats` — Salt Mirror | A dark patch may be firm ground or a weak salt crust. Probe and mark a route. | Crust collapse into brine; markers can be moved to deceive later travelers. |
| `sporefields` — Spore Fields | A previously safe harvest crosses a sporulation stage. Compare samples before communal cooking. | Exposure or contaminated meal; a verified seasonal rule improves future choices this run. |
| `canopy` — Hanging Gardens | A communal platform exceeds its load limit. Move supplies, limit entrants or cut one bridge. | Platform failure; rescue succeeds only through remaining attached paths. |
| `vault` — Vault | A blackout leaves one door on reserve power and a second room short of air. Choose who crosses first. | Entrapment or suffocation; a battery can be salvaged after the crisis. |
| `warren` — Warren | Dust and ventilation reveal an unsafe tunnel. Shore a detour or risk the short path to water. | Collapse or loss of breathable air; a new opening changes the map. |
| `islands` — Shattered Archipelago | A bridge and zip-line share an overloaded anchor. Coordinate crossings or race. | Anchor failure strands or drops a traveler; repair restores a contested link. |
| `eclipse` — Perpetual Eclipse Forest | A changed artificial star pattern conflicts with a known route marker. Verify landmarks. | Misrouting into pitch vents; corrected navigation becomes useful intelligence. |
| `reef` — Dead Coral Reef | A narrow coral passage exposes safe condensation at a damaging tide phase. Wait or squeeze through early. | Laceration, entrapment or brine drowning; deposited water creates a temporary resource. |
| `abattoir` — Industrial Abattoir | A stalled conveyor can be jammed open for salvage. Someone must hold or secure the shutdown. | Restart entanglement/crushing; successful lockout leaves a new route. |
| `carnival` — Forgotten Carnival | Two controls power either a lift or safe lights. Cooperate across the ride or bait another group. | Brake failure or electrical hazard; working lights change stealth and routes. |
| `ashwaste` — Ash Wasteland | Tracks lead across a thin ash bridge over a vent. Read heat and load before following. | Crust failure into hot gas; a safer marked corridor can be sold or falsified. |
| `quarry` — Vertical Quarry | A rockfall dams drainage above the flooded center. Clear it gradually or use it as a barrier. | Sudden release sweeps a lower bench; afterward a submerged route opens. |
| `glacier` — Glacial Cavern Network | A melt channel threatens a supply alcove. Divert, evacuate, or stay for loot. | Flooding followed by freezing traps occupants; meltwater opens another tunnel. |
| `floe` — Shattered Ice Floe Sea | A plate drifts beyond the return gap while two allies are separated. Throw a line or shed equipment and leap. | Cold-water immersion; successful tethering creates a temporary bridge. |
| `alpine` — Avalanche Peaks | A cracked snow slab sits above the only quiet route. Cross spaced out, detour or deliberately release it. | Avalanche burial with a time-limited search; cleared snow uncovers equipment. |
| `terraces` — Terraced Mines | A cable-car brake needs replacement from a lower platform. Repair before hauling a cache. | Runaway car or severed cable; repaired machinery creates an evacuation option. |
| `seapeaks` — Alpine Archipelago | A weather window is shorter than the group’s planned crossing. Split cargo, wait or send a rope team first. | Exhaustion/drowning or exposure on the wall; a fixed line persists. |
| `canopyweb` — Suspended Canopy Web | Wet woven paths sag toward the fog layer. Reroute traffic or sacrifice supplies. | Fog exposure after a web tear; redistributed load saves one route and closes another. |
| `acousticforest` — Whispering Acoustic Forest | A rescue whistle is distorted by hollow trunks. Triangulate or follow the loudest echo. | False approach leads into a trap; validated signal codes become shared knowledge. |
| `burnscar` — Post-Burn Scar | Rain loosens burned roots above a camp. Move the camp or brace the slope. | Deadfall/debris flow; disturbed ground reveals a salvage pocket. |
| `craterfield` — Ordnance Crater Field | Rain exposes a suspicious object beside an established path. Mark a detour or attempt careful recovery. | Disturbance triggers an explosive hazard; a marked exclusion area shapes movement. |
| `culdesac` — Cul-de-Sac | A delivery truck brings power to one house and exhaust to a sealed garage. Inspect before sheltering. | Fume poisoning; safe power supports cooking, light and repair. |
| `labyrinth` — Green Labyrinth | A moving hedge threatens to separate a group mid-transfer. Leave a marker, wait or hold a gate. | Compression/entrapment; a deliberately anchored gap survives one rearrangement. |
| `ashgrove` — Ashgrove Secondary | The bell schedule and posted evacuation route disagree after a door jams. Compare fresh evidence. | Corridor crush or locked-room fire; repaired doors alter chokepoints. |
| `kelvin` — Station Kelvin-9 | Generator fuel competes with heating, lighting and pumping. Allocate fuel with a public ledger. | Cold exposure, fumes or pump failure; a repair extends one service at another’s cost. |
| `silkwood` — Silk Wood | A silk route transmits vibrations to a nest. Cut, pad or cross one at a time. | Entanglement and venom; harvested silk becomes a material with explicit load limits. |
| `nooneplace` — Nooneplace | Repeated corridors erode confidence in a route. Maintain physical markers or follow another tribute. | Exhaustion/dehydration after a false loop; discovered service passages anchor a reliable map. |
| `redcathedral` — Red Cathedral | A river rise threatens climbers’ lower anchor while shade remains above. Move the anchor or cut the haul short. | Falls or flash-flood drowning; relocated water caches change the next journey. |
| `menagerie` — Menagerie | A release latch is damaged while the published schedule remains accurate elsewhere. Repair or exploit the exception. | Animal escape through a newly connected enclosure; verified warnings matter. |
| `storywood` — Story Wood | Two cottages offer incompatible bargains whose costs become visible later. Compare testimony before accepting. | A refuge locks at its stated condition; paying the cost can release another person. |
| `cabin` — Snowbound Homestead | Snow blocks the flue while enemies share the only warm room. Vent heat, clear the roof or evict occupants. | Fume poisoning or exposure outside; chimney work becomes a remembered cooperative act. |
| `magmatube` — Throat of the Mountain | A cooling crust offers access to valuable supplies until a rising heat pulse. Scout and time a retrieval. | Crust breakthrough or gas exposure; successful retrieval spends insulation/rope condition. |
| `karst` — Undermere | Water rises behind a siphon; cannon silence prevents reliable casualty knowledge. Mark water levels and leave signals. | Flood entrapment; a rescue can occur without immediately correcting distant beliefs. |
| `tidewrack` — Tidewrack Flats | Extend the existing forecast pilot with connected channels and an abandoned load. Warn, evacuate or build a crossing. | Return tide isolates the last carrier; receded water redistributes rather than invents salvage. |
| `thresher` — Thresher Floor | A kill-gated resource system creates a conflict over helping someone enter versus taking their supplies. | Machinery shutdown/lock-in near the gate; assistance and coercion have different social records. |
| `vigil` — Vigil | Exhausted groups negotiate access to the dawn treatment site. Assign watches and reserve places. | Microsleep during a crossing or lost treatment access; honored access pacts remain evidence. |
| `saltworks` — Saltworks | Evaporation concentrates contamination around the sole freshwater intake. Flush, ration or reroute it. | Salinity illness/dehydration; repair changes who can reach water without restoring every depleted pan. |
| `kiln` — Kiln | The cool cellar’s ventilation competes with surface heat protection. Open vents or ration occupancy. | Heat/fume entrapment; a new shaft provides relief but exposes the refuge’s location. |

## 7. Universal events and additional ways to die

“Universal” means available across arena definitions when its physical prerequisites exist. It does not mean a flood must occur in every desert or a cliff fall in a flat room. New causes should feed the existing structured cause taxonomy, attribution, obituary, achievement and metrics paths.

| Chain | Warning and consequential choice | Possible death | Nonfatal outcome and memory |
|---|---|---|---|
| Contaminated communal batch | Odd taste, suspect source or another consumer’s symptoms; test, discard, warn or conceal. | Poisoning or later illness. | Find and recall remaining portions; sender’s knowledge affects blame. |
| Smoke in a refuge | Poor ventilation and increasing smoke; open cover, move fire or leave. | Smoke inhalation/asphyxiation. | Saved shelter loses warmth or concealment. |
| Rescue under load | Inspect anchor and assess carried weight; unload, reinforce or seek another helper. | Fall/drowning with distinct accidental or deliberate attribution. | Extracted but injured survivor, dropped recoverable cargo. |
| Overloaded crossing | Bridge/ice/ladder creaks; stagger passage or jettison goods. | Structural failure. | One stranded member, repairable link, evidence of who overloaded it. |
| Failed stabilization | Wound, supply shortage and time pressure; triage, rest or continue moving. | Bleeding or infection progression. | Stabilized but limited limb use; later rehabilitation decision. |
| Water versus shelter | A long exposed water trip competes with staying protected. | Dehydration, exposure or collapse en route. | Rescue cache or escorted return becomes a real supply network. |
| Choking during a rushed meal | Injury, panic or speed eating supplies the prerequisite. | Airway obstruction if nobody capable reaches them. | Assisted recovery costs time and reveals hidden company. |
| Contaminated dressing | Dirty equipment or reused material; clean it or risk immediate treatment. | Delayed sepsis. | Infection traced to a batch, no retroactive blame for unknown danger. |
| Entrapment while scavenging | Unstable debris and valuable visible loot; brace, bring help or leave. | Crushing/asphyxiation. | Tools abandoned, passage changed, rescue obligation fulfilled. |
| Treatment scarcity | Two injured people and one treatment; choose, split only if physically valid, or seek alternatives. | One untreated condition worsens. | Triage affects trust differently from deliberate refusal. |
| Pursuit past exhaustion | A rival is near defeat but the route is dangerous. Stop or continue. | Fall, exposure or a counterattack during collapse. | Escaped enemy remembers being spared or simply losing pursuit. |
| Delayed trap interference | Someone discovers a trap and alters it; mark, dismantle or turn it. | Original owner or another traveler triggers it. | Ownership and modification history separate responsibility. |

Build nonlethal events at least as deliberately: a disputed map, borrowed equipment, repair apprenticeship, shared cooking, exchanged warnings, an honest refusal, disputed credit, restitution, an abandoned project, a false alarm, an escort that succeeds, and a public promise quietly kept.

Do not simply add lethality to the existing scheduler. Replace some repetitive low-information hazard rolls with these chains, and monitor run length, recoverable injury, opportunity for response and death-cause distribution. A death should be surprising in outcome, not inexplicable in prerequisites.

## 8. Trait and archetype balancing

### Current measured picture

The 1,600-run sample produced 1,599 Games with victors, 1 wipeout, **1,632 crowned people including 33 dual wins**, and 28,988 deaths. Entrant denominators below count actual entrants. All 36 archetypes reached at least 500 entrants in this sweep.

| Indicator | Current result | Existing design target / implication |
|---|---:|---|
| Best/worst archetype win-rate ratio | 2.69× | Target ≤2.3×; regression limit is looser at 3.4×. |
| Opportunist | 9.47%, n=507 | Highest observed; investigate access to weakened targets and low-cost finishing. |
| Career archetype | 8.44%, n=1,778 | Strong; distinguish this archetype from the district-based Career cohort. |
| Tracker | 3.51%, n=569 | Lowest observed; check whether information becomes favorable engagements. |
| Broker | 3.78%, n=1,005 | Signature fires in 30.0%, only just above the 29% regression floor. |
| Herald / Debtor / Forager | 3.64% / 3.75% / 3.77% | Examine role opportunity and conversion to late-game survival. |
| Career cohort share of victors | 49.9% | Target ≤45%; this is not the Career archetype’s win probability. |
| Sanity-floor tribute-time | 19.3% | Target ≤15%; mid-band time is healthier at 49.7%. |
| Final-two strangers | 31.4% | Target ≤30%; improve meaningful prior encounters without forcing friendship. |
| Average Games length | 10.39 days, SD 2.82 | Target 10.5–12 days; variation target is met. |
| Training scores ≥9 | 23.5% | Target 12–18%; score inflation erodes the distinction of elite scores. |
| Bloodbath loss | 31.9% of entrants | Target 33–50%; do not increase blindly while also increasing other lethality. |
| Zero-kill victors | 8.8% | Existing target ≤6%; this is a design choice, not a correctness bug. |

The other unmet targets are best archetype rate, rarest stance share, average victor end health and lover-run frequency. The report’s 12-goal total comes from the harness, not from counting only the rows above.

**Do not treat these raw rankings as causal estimates.** District, arena, preferred traits, age, body, starting items and available opponents confound them. The top and bottom are selected extremes; their uncertainty is wider than a single point estimate suggests. Fix the rescue/resource defects before fine tuning their beneficiaries.

### Concrete balance work

1. **Matched cohorts:** compare otherwise matched casts across archetype/trait changes using fixed scenario inputs and deterministic random streams. A shared seed alone is not a clean counterfactual if an earlier branch consumes different random draws.
2. **Opportunity funnel:** for each signature measure alive long enough → prerequisite available → aware of opportunity → legal action affordable → attempted → succeeded → lasting benefit. This prevents hiding an opportunity failure behind a larger bonus.
3. **Tracker:** measure target discovery, route feasibility, safe intercepts and kills/escapes after a tracked contact. Reward useful information or avoided danger as well as pursuit; do not make every Tracker charge a stronger target.
4. **Broker:** measure same-place customers with complementary surplus, affordable transactions, retained goods and later uses. Make a successful trade capable of solving an urgent need. Improving arbitrary sale multipliers will not fix inaccessible customers.
5. **Opportunist/Career:** inspect finishing credit, free repeated action opportunities, starting kit and target-selection advantage. Price the behavior causing the edge before applying a global combat nerf.
6. **Low-signature archetypes:** Cartographer 33.3%, Duellist 33.1%, Bellwether 32.8%, Courier 32.5%, Captor 32.0% and Broker 30.0% are below the 35% target. Give each common, role-appropriate opportunities before broadening its signature into a generic survival trigger.
7. **Sanity:** bound repeated grief/vengeance shocks from one incident; preserve event attribution and recovery opportunities. At the floor, behavior should remain varied rather than repeatedly emit the same breakdown. Measure exits from the floor, not only time spent there.
8. **Training:** separate station competence from public score. Keep exceptional results rare without depriving low starters of opportunities to learn.
9. **Trait evaluation:** report acquisition at reaping separately from earned traits; retain pre-acquisition state for earned-trait analysis. Do not call high survival among holders of “Outlived The Pack” proof that the trait is overpowered.
10. **Coverage:** the guarded trait spread is 2.48× over 27 sufficiently sampled labels, while the exploratory whole table is 3.84×. The latter is not proof of imbalance. Deliberately oversample rare traits and tradeoffs across applicable arenas.

Absolute sums of mixed modifiers are only a rough inspection aid: a combat point, a probability offset and a hunger-drain unit are not interchangeable units of power. Use actual choices, exposure and outcomes to judge a trait.

## 9. QOL, UI and UX backlog

These are recommendations unless tied to F16–F18. Existing text scaling, accessibility hints, comparison views, filters, rewind, slots and command navigation should be retained and improved rather than rebuilt as absent features.

| Priority | Change | Acceptance criterion |
|---|---|---|
| P1 | Save state shows persistent, temporary, quota-limited and failed status. | Reload cannot silently contradict “saved”; export remains available on failure. |
| P1 | Shared-run error recovery and honest replay labels. | Bad links do not crash; a changed-version replay explains its scope before starting. |
| P2 | Budget and project panel in tribute details. | Show hours remaining, current project site, progress, reserved materials and why it paused. These state fields currently have no dedicated component references found in the source scan. |
| P2 | Forecasts on map/dossier. | Show kind, due cycle, known severity, mitigation and safe options; do not confuse active effects with pending warnings. |
| P2 | Upper/lower occupancy and reachable connections. | A player can understand why visible people cannot trade or treat each other. |
| P2 | Explain actual decisions. | Chosen option, meaningful rejected alternative, costs and uncertainty; handle hysteresis correctly. |
| P2 | Causal event inspection. | From a death, jump to wound, source incident, failed escape/rescue and attribution. |
| P2 | Alliance ledger. | Inspect promises, ration entitlements, real deliveries, disputes and membership changes. |
| P2 | Follow/watch lists and configurable pauses. | Pause on watched-tribute injury, death, betrayal, imminent hazard or finale without stopping for every flavor line. |
| P2 | Clear phase digest plus expandable feed. | Distinguish changes, continuing conditions and ambient prose; preserve access to full chronology. |
| P2 | Achievement search and eligibility. | Search by arena, mode, system and rarity; show measurable near misses without revealing hidden narrative spoilers by default. |
| P2 | Cast validation and single-name collision handling. | Trim blanks, handle Unicode, retain first names, warn about visually confusing duplicates, show district badges. |
| P2 | Seed/rules/campaign summary before launch. | A copied setup reveals what is inherited and which settings change the cast or outcome. |
| P2 | Mobile and accessible interaction pass. | At narrow widths and 200% zoom: no clipped primary controls; keyboard focus visible; dialogs restore focus; graphs have a list/table alternative. |
| P2 | Feed accessibility and motion/audio preferences. | Announce a compact batch summary rather than hundreds of log lines; color is never the only signal. Honor reduced motion. |
| P2 | Loading and cancellation feedback. | Large initial content download and run-to-end work show useful progress; cancel leaves a valid phase boundary. |
| P3 | Explain confidence, not fake precision. | Odds are labeled model estimates; risk and beliefs do not imply exact knowledge the tribute lacks. |
| P3 | Catalog counts and search performance. | Large achievement and arena lists remain responsive; lazy-load optional catalog/prose content after measuring the import graph. |

The 2.83 MB initial JavaScript chunk deserves a production network/CPU profile. Split by actual reachability and usage, not by an arbitrary bundle warning threshold. Measure time to first usable setup and first phase on a modest phone. No live performance timings were collected here.

## 10. Side features and shallow mechanics worth deepening

| Existing surface | Next useful depth | Robustness boundary |
|---|---|---|
| Betting and side markets | Explain settlement evidence, pushes, house margin and why a quote changed. Evaluate prediction calibration by market and configuration. | Replays, rewinds and imports must not mint coins through repeated settlement. Test it; no exploit is claimed here. |
| Sponsorship and patronage | Gifts constrained by delivery windows, sponsor priorities and consequences of conspicuous aid. | Every no-sponsor rule applies to all senders; failed delivery retains an explicit outcome and cost policy. |
| Mentors and campaign | Mentor tendencies influence advice/delivery preference; rival district histories alter expectations rather than guarantee stats. | Snapshot starting history; bounded advantages; all dual winners represented consistently. |
| Heirlooms and named equipment | Ownership chains, repairs, theft, recovery and gifts create continuity. | Names/quirks that affect modifiers are not “purely cosmetic”; classify them honestly and replay them. |
| Crafting and repair | Material compatibility, tool sharing, quality versus speed, interruptible site projects. | Materials and labor conserved; no finished item if its component was already traded away. |
| Food and water | Batches, safe preparation, preservation, transport containers, verified sources. | Stack splits preserve freshness/contamination; hunger and thirst are different needs. |
| Camps and zone control | Ownership, visitor rules, noise, watches, occupancy and evacuation plans. | A claimed camp does not confer remote access to its goods or visibility. |
| Rumours and messages | Sender chain, confidence, expiry, contradictory reports and verified correction. | A repeated false claim is not necessarily a deliberate lie; information travels physically. |
| Training and interviews | Rival practice, mentor feedback, audience expectations and commitments with later consequences. | Distinguish public performance from actual competence; attempts can teach even when they fail. |
| Hall of Fame and archives | Search stories by cause, allegiance change, rescued ally, shared item and arena transformation. | Typed records survive trimmed prose and schema migrations. |
| Rewind and save slots | Label branch points and compare causal differences between branches. | Freeze campaign inputs and interventions; clearly separate playback from a fresh simulation. |
| Gamemaker mode | Preview affected zones/tributes, show intervention costs and record action history. | Never bypass valid winner, death attribution, reachability or save invariants. |

The repository currently has some achievements that parse prose with regular expressions. Migrate factual triggers to typed events/counters incrementally, beginning with anything affected by log trimming or localization. More flavor text should not change whether an achievement is earned.

## 11. Replayability beyond adding content

1. **Scenario manifests:** curated starts such as divided supplies, an injured leader, rival maps or a failing water system. Record initial conditions and version so challenges can be compared fairly.
2. **Different strategic pressures:** vary route stability, resource distribution, visibility, warning reliability and cooperation value. More arena names with the same movement/resource pattern do little for replayability.
3. **Story-aware scheduling:** track repeated situation types, actors and outcomes—not just repeated strings. Reduce the tenth vengeance oath’s airtime while preserving the first consequential pursuit.
4. **Opportunity coverage:** measure how often the player actually sees each new mechanic. A complex subsystem that appears in one of a thousand runs is not everyday depth.
5. **Character-specific arcs:** an initial belief challenged, a debt repaid at a cost, a strategy abandoned, a repeated mistake learned from. Require evidence from actions rather than assigning an arc label retrospectively.
6. **Alternative finales with rules:** several arenas may favor evacuation races, dwindling refuge access, contested machinery or a moving resource. Keep victory conditions explicit and avoid changing them merely to force a dramatic ending. Build on the endgame variation already present.
7. **Discovery without power inflation:** unlock dossiers, scenario options, commentary and cosmetic presentation instead of endlessly increasing starting survival bonuses.
8. **Counterfactual debrief:** “This bridge failure separated the alliance; the later ration dispute occurred because the courier could not return.” Offer a branch at that moment using existing rewind foundations.
9. **Optional recent-content suppression:** reduce recently seen names/arena skins/events for season play, but snapshot that history into the manifest. Ordinary seeded runs must not depend on hidden player history.
10. **Run-shape diversity measures:** distributions of first-contact timing, alliance duration, resource bottlenecks, injury recovery, betrayal motive, endgame mechanism and narrative concentration. Use these alongside mean run length and win rates.

Preserve quiet stretches and nonfatal consequences. Making every phase a major disaster exhausts the player and makes significant events feel interchangeable.

## 12. More achievements, with exact triggers

Current measurement: **35 never unlocked in the 500-run sample, 11 unlocked in at least 60%, and 213/396 fell in the 5–60% band**. “Unobserved” does not mean unreachable. `a8-bought-nothing` unlocked in 100% of this no-player-purchase sample: interaction-dependent achievements need an eligible-mode denominator, not an automatic difficulty verdict from unattended simulations.

The following 24 are proposed specifications, not shipped IDs or assigned rarities. Screen semantic overlap with the current 396 before adding; strengthen or replace a weak existing entry where appropriate. Rarity should follow measured eligible opportunities. Each needs a positive fixture, a near-miss fixture, save/resume coverage and typed evidence.

| Candidate title | Exact proposed trigger |
|---|---|
| One at a Time | Complete a crossing after explicitly splitting an initially over-limit group load into legal trips. |
| The Missing Portion | Resolve a ration discrepancy using recorded quantities, and restore the missing unit to its rightful cache/recipient. |
| A Seat Returned | Rejoin an alliance after a recorded ration walkout under a new term, then fulfill that term. |
| Out, Not Up | Extract a downed ally into safety while they remain medically downed; a separate later treatment revives them. |
| No Second Victim | Refuse an unsafe rescue method, prepare a safer one, and complete extraction before the deadline. |
| The Line Stayed | Recover and reuse the same uniquely identified rope in two successful rescues. |
| Last Safe Crossing | Escort another tribute over a link before its forecast closure without exceeding its capacity. |
| The Warning Was Wrong | Reject a false warning using independent evidence, then safely complete the affected route. |
| Corrected in Public | A rumor’s sender publicly corrects it and at least one recorded recipient changes their plan. |
| Someone Else’s Frame | Finish a site project begun by a now-dead tribute and use it successfully. |
| Empty Hands, Full Promise | Deliver a promised item after giving up a personally valuable carried item to retain the delivery. |
| Receipt of Mercy | A tribute spared during an execution opportunity later supplies necessary treatment to that same person. |
| Different Debts | Repay both an equipment loan and a rescue obligation to different people in one run. |
| The Door Held | Maintain a passage long enough for a named ally to cross, then leave safely yourself. |
| Fresh Water for Three | Deliver verified safe water from one source to three distinct recipients who consume it. |
| One Batch Recalled | Identify contamination and recover/discard every remaining portion of that specific distributed batch. |
| Fuel for Tomorrow | Preserve a limited service through an announced shutdown by a completed repair and recorded fuel allocation. |
| Who Really Cut It | Resolve a rope-cut accusation using a recorded witness or item evidence, not global omniscience. |
| The Other Proposal | A rejected leader supports the winning plan through its first meaningful crisis. |
| Without a Cannon | In a cannon-suppressed arena, correctly confirm a missing ally’s fate through direct evidence. |
| After the Water | Return after the same recorded flood recedes and recover a previously displaced item. |
| A Map Worth Keeping | A verified map correction prevents a forecast route failure for two distinct users. |
| A Different Ending | Career-level record of four distinct typed endgame mechanisms, not merely four arena IDs. |
| Both Kept Their Word | Two opposing parties fulfill both sides of a resource agreement and honor its expiry without a breach. |

Avoid rewards for repeatedly watching an unavoidable animation or for facts automatically true in a default unattended run. New systems should launch with a small, distinct achievement set rather than a quota of cards.

## 13. First-name-only expansion

Raw quantity is not the principal naming shortage: there are 4,238 tribute pool entries already, and the name checker reports a 4:1 initial-letter spread and 204 mentor names. Improve variety of sound, length and initials, recent-cast repetition and readability alongside new names.

These **120 proposed given names were checked case-insensitively against the current district and neutral tribute pools and were absent**. This does not establish absence from mentor or other character pools, and it is not a finalized district/gender allocation. Several similar-sounding names should not be selected into the same cast. Use curated allocation and retain neutral options.

| Group | New given-name candidates |
|---|---|
| 1 | Avelis, Belira, Celian, Delune, Elvian, Faelin, Galira, Ilyra, Joviel, Kaelis |
| 2 | Liorin, Maelis, Neral, Olyra, Paelin, Quelia, Raelis, Selune, Taviel, Ulyra |
| 3 | Vaelin, Wylia, Xevan, Ylora, Zaelis, Amriel, Brenia, Coriel, Delys, Evara |
| 4 | Feriel, Galyx, Hespera, Isriel, Jovia, Kelune, Luvia, Meriel, Noriel, Orelis |
| 5 | Perian, Quorin, Ruvia, Seriel, Telys, Uvian, Virel, Welyn, Yven, Zoriel |
| 6 | Anira, Belys, Cevan, Doriel, Elysia, Feryn, Ganel, Helys, Ivel, Jaren |
| 7 | Kerys, Lavel, Meryn, Orien, Pelira, Quenel, Relys, Sivian, Toriel, Uliel |
| 8 | Velys, Welian, Xorin, Ysera, Zelys, Arvel, Ceryn, Dovian, Erelis, Faven |
| 9 | Girel, Hovian, Iselle, Juviel, Kirel, Lerys, Moriel, Nelys, Ovian, Peryn |
| 10 | Qira, Rovel, Seryn, Tovian, Urelis, Varen, Weryn, Xaviel, Yrel, Zeryn |
| 11 | Aureli, Brelia, Caliel, Darel, Evania, Firael, Grelia, Haliel, Ilora, Jarel |
| 12 | Kavia, Lurel, Naviel, Ovel, Pirael, Quenra, Ravia, Sarel, Theryn, Uvara |

Selection rules: preserve deterministic draws, prevent exact within-cast collisions where the mode requires unique names, penalize near-homophones in one cast, and balance readable short/long names. A duplicate never triggers a generated surname. Plain-name mode’s district descriptors are labels, not a reason to restore surname functionality.

## 14. Additional traits, skills and archetypes

At 184 traits and 36 archetypes, expansion must buy distinguishable behavior. Avoid another modifier-only synonym for an existing trait. The concepts below require semantic review against the current table; some should be learned tendencies or specializations rather than permanent starting rolls.

### Sixteen trait concepts

| Concept | New decision/tradeoff | Natural counterweight |
|---|---|---|
| Checks the Anchor | Inspects a crossing or rescue before loading it. | Costs urgent response time. |
| Portions First | Splits communal stacks into entitlements before anyone takes them. | Delays departure and exposes stock to observers. |
| Leaves a Marker | Marks verified routes and hazard boundaries. | Rivals can use or tamper with the same markers. |
| Waits for Proof | Demands independent support for consequential rumors. | Sometimes reacts late to a true warning. |
| Carries the Spare | Reserves a role-specific replacement part for group infrastructure. | Reduced carrying room for personal needs. |
| Stays for the Last | Delays evacuation for the last reachable ally. | Risks missing the safe window. |
| Says No Early | Refuses obligations it cannot reasonably fulfill. | Gains fewer early social opportunities. |
| Revises the Plan | Replans when credible evidence invalidates a prerequisite. | Can lose value by abandoning a nearly complete plan. |
| Keeps the Reserve | Protects a disclosed emergency ration. | Immediate hunger and criticism during ordinary shortages. |
| Tests Before Sharing | Checks suspect batches before distribution. | Uses samples, supplies and time. |
| Gives Up the Prize | Can drop a valued item to keep a rescue or delivery viable. | Lower personal equipment quality afterward. |
| Claims the Credit | Publicizes contributions to secure influence. | Creates resentment and makes quiet cooperation harder. |
| Accepts Restitution | Allows a concrete repair to reopen cooperation. | Vulnerable to a second calculated betrayal. |
| Names an Alternate | Plans a replacement helper or route before a risky task. | Planning takes time and may reveal intentions. |
| Repairs the Common Room | Prioritizes shared infrastructure with a visible personal stake. | Rivals may benefit; personal recovery may be delayed. |
| Walks Away in Time | Ends a pursuit at a known risk boundary. | Gives up some easy-looking finishes. |

Do not assign a token negative modifier merely to make a trait look balanced. The cost should occur in the same situations where the benefit matters. Learned tendencies require repeated evidence and a defined weakening/contradiction path.

### Skills: deepen existing opportunities first

Existing proficiencies already include climbing, swimming, crafting, carpentry, medicine, navigation, signalling, fieldcookery, pacing, readingPeople, persuasion and oratory, alongside combat/forage/tracking/stealth/intimidation/butchery. Prioritize these specializations:

| Specialization | Parent skills | Repeatable practice and meaningful uses |
|---|---|---|
| Rigging | Climbing + crafting | Inspect anchors, secure cargo, haul people, repair suspended routes. |
| Triage | Medicine | Stabilize, prioritize limited supplies, coordinate transport and delayed treatment. |
| Preservation | Fieldcookery + crafting | Prepare food batches, dry/store supplies, recognize unsafe storage. |
| Route surveying | Navigation + signalling | Verify crossings, mark closures, communicate changing topology. |
| Structural inspection | Carpentry | Recognize overload, shore supports, plan staged evacuation. |
| Evidence checking | ReadingPeople + tracking | Compare testimony with tracks/items; distinguish mistake from deception. |
| Group coordination | Oratory + pacing | Schedule crossings, watches and multi-person projects. |
| Equipment maintenance | Crafting | Repair condition, choose compatible parts, decide when replacement is better. |

Promote a specialization to a separate skill only if it has multiple common learning opportunities, consequential uses, visible progress and counterplay. Reward meaningful attempts, not only successes that already require mastery.

### Four archetype pilots

| Archetype concept | Distinct strategy | Signature, cost and overlap boundary |
|---|---|---|
| Rigger | Makes and maintains safe connections between separated places and people. | A prepared anchor enables an otherwise impossible haul/crossing. Tools, time and load matter. Must differ from Courier’s delivery loop and Protector’s combat support. |
| Arbitrator | Maintains cooperation through evidence and renegotiated terms. | Resolves an actual dispute through fulfilled restitution. Takes time and can fail; not another flat persuasion bonus or Broker trade. |
| Reclaimer | Returns to changed sites to restore infrastructure and recover identified goods. | Restores a damaged site that is subsequently used. More than Scavenger’s loot acquisition or Forager’s resource finding. |
| Evacuator | Plans and executes movement of vulnerable people before hazards arrive. | A staged withdrawal succeeds within real route/time constraints. Gives up personal opportunities; distinct from one-person protection. |

Ship one or two pilots first. Each needs solo viability, common opportunities before death, failure variants and a measurable behavioral fingerprint. Do not add four low-frequency signatures and call them four playstyles.

## 15. Implementation sequence and release gates

| Batch | Scope | Exit criteria |
|---|---|---|
| A — Protect data and truthful recovery | F01–F03; invalid-link handling. | Failed migration preserves the old save; malformed campaign cannot enter the engine; temporary storage is honestly labeled. |
| B — Physical correctness | F04–F12, F14–F15. | Downed state machine owns explicit rescue injury/termination; actions require capability/reach; portions, overflow and world time conserve correctly. |
| C — Explain the real run | F13, F16–F21; budgets/forecasts/alliance dossier. | Narrative follows recorded facts; chosen-action reasons are correct; replay scope is explicit; browser/phone accessibility pass completed. |
| D — Balance and pacing | Controlled cohorts; signature funnels; sanity and training. | Report sample sizes/intervals and causal hypotheses; no tuning based solely on a selected extreme; full applicable arena/config coverage. |
| E — Deep content | Three universal chains and three contrasting arena pilots. | Warning, choice, legal resolution, nonfatal branch and remembered outcome; distinctive decisions observed in natural runs. |
| F — Expansion | Remaining arena briefs, selected achievements, screened first names, trait/archetype pilots. | Content adds a new choice or consequence; catalog semantics do not duplicate; no surnames. |

Cross-cutting invariants: deterministic behavior for a complete supported manifest; save/resume equivalence; item quantity and metadata conservation; no negative time; active/capable participants; correct physical contact; valid winner sets; consistent attribution; deadlines advancing in every elapsed phase; and summaries supported by durable evidence.

The existing tests are valuable and passing. Add focused assertions at subsystem boundaries instead of merely increasing the number of random runs. In particular, asserting that `rescue-line-held` fired is weaker than asserting that the person was extracted into a valid resulting state.

## Appendix A. New probe observations

Probe identifiers below correspond to the executable source in Appendix B, not to the F-series backlog numbering.

| Probe | Observed result |
|---|---|
| B01 clean downed rescue | Seed index 5: `clean`, health 0, still downed, rescuer hours 0. |
| B02 cut downed rope | Seed index 2: victim remains alive/downed at 0; no new damage source or downed attacker assigned. |
| B03 downed climbing | Downed person moves lower → upper with 0 hours; log says they climbed. |
| B04 remote cache | Three separate sectors; a four-unit bread stack goes to the first member; two are passed over. |
| B05 returned walkout | Current alliance matches original, but follow-up says they have not gone back. |
| B06 separated rescue pair | `samePlace=false`, but follow-up claims continuous arm’s-reach proximity. |
| B07 migration quota failure | In-memory value returned; stored key collection empty. |
| B08 malformed campaign | Decoder accepts `[null]` history; simulator throws reading `victorDistrict`. |
| B09 berries as equipment | Only Nightlock Berries carried; anchor classified `rigged`. |
| B10 feast forecast | Cycle advances to 6; due-cycle-6 flood remains pending, effect list empty. |
| B11 helper selection | 100 tries, no attempt; healthy alternative has 100 health. |
| B12 cross-level medical aid | `samePlace=false`; lower-level victim revived to 22 by upper-level helper. |

Some fixtures deliberately position state to isolate an invariant; they do not establish how often the defect appears in ordinary games. The production calls and source paths establish why the boundary matters. No probabilities in the proposed expansions are presented as calibrated values.

## Appendix B. Reproducible probe source

Place the following file at `scripts/current-audit-probe.ts` in a checkout of the audited revision after dependency installation, then run `node --import tsx scripts/current-audit-probe.ts`. It prints the observed current behavior rather than asserting the desired corrected behavior. It performs no remote writes.

```ts
import { world } from './scenarios';
import { createContext } from '../src/engine/context';
import { RNG } from '../src/utils/rng';
import { tickRescueLines, tickRescueAftermath } from '../src/engine/rescueLine';
import { tickAllianceDisputes, tickDisputeAftermath } from '../src/engine/allianceDispute';
import { registerAlliance } from '../src/engine/alliance';
import { goDown, tickDowned } from '../src/engine/downed';
import { tickVerticality, samePlace } from '../src/engine/verticality';
import { ITEMS, ARENAS } from '../src/data/constants';
import { RESCUE_LINE, ALLIANCE_DISPUTE } from '../src/data/balance';
import { setStorageBackend, readStored } from '../src/utils/storage';
import { decodeCampaign, encodeCampaign } from '../src/utils/campaignLink';
import { Simulator } from '../src/engine/simulator';
import { initialRunState } from './runInit';
import { DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { TRAIT_DEFS } from '../src/data/traits';
import { ARCHETYPES } from '../src/data/archetypes';
import { ACHIEVEMENTS, META_ACHIEVEMENTS } from '../src/data/achievements';
import { DISTRICT_NAMES, NEUTRAL_NAMES } from '../src/data/names';
import { processFeast } from '../src/engine/phases/feast';

const emit=(id:string,result:unknown)=>console.log(id,JSON.stringify(result));
function rescue(seed:string) {
 const w=world(seed); const [a,b]=w.state.tributes; w.only(a,b);
 a.zone=b.zone=w.state.arena.zones[0].name; b.health=100;
 a.allianceId=b.allianceId='pair'; b.relationships[a.id]=100;
 b.inventory=[]; b.hoursLeft=0;
 goDown(createContext(w.state,new RNG(seed)),a,'original wound');
 return {w,a,b};
}
for(let i=0;i<1000;i++) {
 const {w,a,b}=rescue('clean-'+i);
 tickRescueLines(createContext(w.state,new RNG('clean-roll-'+i)));
 if(w.state.rescueLines?.[0]?.outcome==='clean') {
  emit('B01-clean-downed',{seed:i,health:a.health,downed:!!a.downed,hours:b.hoursLeft,record:w.state.rescueLines[0]});break;
 }
}
for(let i=0;i<1000;i++) {
 const {w,a,b}=rescue('cut-'+i); b.archetype='career'; b.relationships[a.id]=-100;
 tickRescueLines(createContext(w.state,new RNG('cut-roll-'+i)));
 if(w.state.rescueLines?.[0]?.outcome==='cut') {
  emit('B02-cut-downed',{seed:i,health:a.health,downed:!!a.downed,status:a.status,source:a.lastDamage?.sourceId,downedBy:a.downed?.byId,rescuer:b.id});break;
 }
}
{
 const w=world('vertical-down');const a=w.state.tributes[0];w.only(a);
 const z=w.state.arena.zones[0];z.features={...z.features,vertical:true};a.zone=z.name;a.zoneLevel='lower';
 goDown(createContext(w.state,new RNG('down')),a,'wound');a.hoursLeft=0;
 for(let i=0;i<1000&&a.zoneLevel==='lower';i++)tickVerticality(createContext(w.state,new RNG('vertical-'+i)));
 emit('B03-downed-climbs',{level:a.zoneLevel,downed:!!a.downed,hours:a.hoursLeft,log:w.state.log.at(-1)?.text});
}
{
 const w=world('remote-cache');const ms=w.state.tributes.slice(0,3);w.only(...ms);
 const ctx=createContext(w.state,new RNG('remote-cache'));ms.forEach((t,i)=>{t.allianceId='probe';t.zone=w.state.arena.zones[i].name;t.vitals.hunger=95;t.vitals.thirst=95;t.inventory=[]});
 const r=registerAlliance(ctx,'probe',ms);r.sharedCache=[{...structuredClone(ITEMS.find(i=>i.type==='food')!),value:1,stack:4}];r.campZone='UNATTENDED CAMP';
 tickAllianceDisputes(ctx);
 emit('B04-remote-cache',{camp:r.campZone,members:ms.map(t=>({zone:t.zone,items:t.inventory.map(i=>({name:i.name,stack:i.stack}))})),dispute:w.state.allianceDisputes?.[0]});
 const d=w.state.allianceDisputes?.[0];if(d){d.walkoutIds=[ms[0].id];d.passedOverIds=[ms[0].id];ms[0].allianceId='probe';w.state.cycle=d.cycle+ALLIANCE_DISPUTE.aftermathCycles;tickDisputeAftermath(ctx);emit('B05-returned-walkout',{currentAlliance:ms[0].allianceId,text:w.state.log.at(-1)?.text});}
}
{
 const {w,a,b}=rescue('followup');delete a.downed;a.health=100;
 w.state.rescueLines=[{rescuerId:b.id,strandedId:a.id,zone:a.zone,anchor:'improvised',stranding:'downed',outcome:'clean',cycle:1}];
 a.zone=w.state.arena.zones[1].name;b.zone=w.state.arena.zones[2].name;w.state.cycle=1+RESCUE_LINE.aftermathCycles;
 tickRescueAftermath(createContext(w.state,new RNG('followup')));emit('B06-separated-followup',{samePlace:samePlace(w.state.arena,a,b),text:w.state.log.at(-1)?.text});
}
{
 const data=new Map([['old','{"x":1}']]);setStorageBackend({getItem:k=>data.get(k)??null,setItem:()=>{throw new DOMException('full','QuotaExceededError')},removeItem:k=>{data.delete(k)}});
 const result=readStored({key:'new',legacyKeys:['old'],version:1,migrate:r=>r});emit('B07-migration-loss',{returned:result,remaining:[...data.keys()]});setStorageBackend(null);
}
{
 const campaign=decodeCampaign(encodeCampaign({runs:1,victors:1,recentRuns:[null]} as any));
 const s=initialRunState({seed:'bad-campaign',arenaId:ARENAS[0].id,config:DEFAULT_GAME_CONFIG});s.campaign=campaign;
 try{const sim=new Simulator(s);for(let i=0;i<20&&!sim.isFinished();i++)sim.advance();emit('B08-malformed-campaign',{accepted:!!campaign,crashed:false})}catch(e){emit('B08-malformed-campaign',{accepted:!!campaign,error:String(e)})}
}
emit('CENSUS',{arenas:ARENAS.map(a=>({id:a.id,name:a.name})),traits:Object.keys(TRAIT_DEFS).length,rollable:Object.values(TRAIT_DEFS).filter(t=>!t.earned).length,archetypes:Object.values(ARCHETYPES).map(a=>a.name),achievements:ACHIEVEMENTS.length,meta:META_ACHIEVEMENTS.length,names:Object.values(DISTRICT_NAMES).flatMap(g=>Object.values(g).flat()).length,neutral:Object.values(NEUTRAL_NAMES).flat().length});
{
 for(let i=0;i<100;i++){
  const {w,a,b}=rescue('berry-'+i);b.inventory=[structuredClone(ITEMS.find(i=>i.id==='nightlock')!)];b.traits=['Rope-Handed'];
  tickRescueLines(createContext(w.state,new RNG('berry-'+i)));
  if(w.state.rescueLines?.length){emit('B09-berries-as-rope',{inventory:b.inventory.map(i=>i.name),anchor:w.state.rescueLines[0].anchor});break;}
 }
}
{
 const w=world('feast-forecast',{day:5});const z=w.state.arena.zones[1];
 w.state.forecasts=[{zone:z.name,kind:'flooded',source:'weather',dueCycle:6,severity:1,mitigation:0} as any];
 processFeast(createContext(w.state,new RNG('feast-forecast')));
 emit('B10-feast-clock',{cycle:w.state.cycle,forecasts:w.state.forecasts,effects:w.state.zoneEffects?.[z.name]??[]});
}
{
 const w=world('healthy-helper');const [a,b,c]=w.state.tributes;w.only(a,b,c);a.zone=b.zone=c.zone=w.state.arena.zones[0].name;
 a.allianceId=b.allianceId=c.allianceId='pair';b.health=1;c.health=100;b.archetype=c.archetype='medic';b.relationships[a.id]=100;c.relationships[a.id]=50;
 goDown(createContext(w.state,new RNG('down')),a,'wound');
 for(let i=0;i<100;i++)tickRescueLines(createContext(w.state,new RNG('helper-'+i)));
 emit('B11-ineligible-volunteer-blocks',{attempts:w.state.rescueLines?.length??0,healthyCandidate:c.health});
}
{
 for(let i=0;i<100;i++){
  const w=world('remote-medical');const [a,b]=w.state.tributes;const z=w.state.arena.zones[0];z.features={...z.features,vertical:true};
  w.state.tributes.forEach(t=>t.zone=w.state.arena.zones[1].name);
  a.zone=b.zone=z.name;a.zoneLevel='lower';b.zoneLevel='upper';a.allianceId=b.allianceId='pair';b.proficiencies={medicine:6};b.inventory=[];
  goDown(createContext(w.state,new RNG('down')),a,'wound');tickDowned(createContext(w.state,new RNG('med-'+i)));
  if(a.revivedBy){emit('B12-medical-through-floor',{samePlace:samePlace(w.state.arena,a,b),health:a.health,revivedBy:a.revivedBy});break;}
 }
}
```
