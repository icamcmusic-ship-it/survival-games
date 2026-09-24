# Survival Games — AUDIT-11: current-code audit and expansion plan

Audited revision: [`fabf045`](https://github.com/icamcmusic-ship-it/survival-games/tree/fabf045ee5cf5afc871403f93c48380dd325cbf3) ("What if? — a counterfactual debrief", #98). Audit date: 24 September 2026.

This is an audit and backlog. No production source was changed. Findings marked **Confirmed** were reproduced by execution (seeded runs, Playwright in Chromium) or verified line-by-line against the source; **Plausible** means the code path is clear but no natural-run frequency was measured. Items already recorded as fixed in `CHANGELOG.md` / AUDIT-1…10 were excluded.

**Naming constraint (unchanged):** one given-name field only. No surnames, surname pools, toggles, generation or hidden metadata. Disambiguate by district badge and internal ID; epithets stay separate from the name.

---

## 1. What matters most

1. **A family of `undefined === undefined` alliance checks (E1–E2).** Two unaligned loners are treated as *allies* at eight call sites. This quietly breaks convergence hunts, witness counts, shadowing, protector/courier/martyr hooks and nursing. `isHostileTo` already exists; it is just not used everywhere. This is the single highest-leverage engine fix.
2. **Dark mode and phone layout are broken in the chrome (U1–U2).** The header is cream-on-white in dark mode, and at 380 px the sticky broadcast bar covers the header and leaves ~250 px of content.
3. **Careers win 62 % of Games** at 400 runs — above the ≤60 % guard, far above the ≤45 % goal. Districts 1/2/4 take 64 % of crowns; D11 wins 2 %.
4. **Stance monoculture.** Evasive + Aggressive are 71 % of stance-cycles; ten stances share the remaining 29 %.
5. **Death is 65 % "another tribute".** Mutts (1.7 %) and starvation (0.2 %) barely register, and 853 of 1,337 authored event cause strings classify statically as `unknown`.

## 2. Evidence

| Check | Result |
|---|---|
| `npm run lint` (tsc + eslint) | Pass. 0 errors, 17 warnings (hook deps, refs-during-render). |
| `test:sim` soak | Pass. No invariant violations; 129/129 typed beats fired. |
| `test:references / achievements / names / scenarios / audit10-fixes / actions / endgame` | All pass. |
| `test:metrics` (400 runs) | Completes; **Career victor share 62.0 % fails the ≤60 % guard.** Archetype/trait guards abstain at n=400. |
| Custom invariant harness (40 seeded Games) | No crashes, NaN, bad zones or unfinished runs. Found phantom empty alliances (E14). |
| Playwright / Chromium (dev server) | Reproduced U1, U2, U3, U7. |

No finite review can certify it found every bug; UI items without "Confirmed" are source-based.

---

## 3. Bugs

Priority: **P1** broken core behaviour or visible breakage; **P2** incorrect mechanics or misleading output; **P3** latent / maintenance.

### 3.1 Engine

**E1 — P1 — Confirmed — Loners never count as rivals at convergence.** `src/engine/objectives.ts:313-314` uses `o.allianceId !== t.allianceId`; for two unaligned tributes that is `undefined !== undefined === false`. The tier-99 convergence hunt therefore never fires between solo tributes, which is exactly the "people meeting" the mechanic exists for. Fix: `isHostileTo(t, o)` (`alliance.ts:79`).

**E2 — P2 — Confirmed — The same equality bug at seven more sites.** `arenaSignature.ts:438`, `:709` (sightings); `combat.ts:2002` (post-kill onlookers — loner witnesses ignored, so looting happens in front of them); `stanceBeats.ts:51` (`alliesPresent` counts every loner as an ally); `archetypeHooks.ts:193` protectorStand, `:450` courier listener, `:578` martyrOffer (any loner is a "ward"). Fix: a single `allied(a, b)` helper requiring a defined `allianceId`, plus an eslint `no-restricted-syntax` rule banning raw `allianceId ===` / `!==` comparisons.

**E3 — P2 — Confirmed — The Nursing action disagrees with the Nursing stance.** The stance (`stance.ts:471-483`, `nursingPatients`) accepts truce partners, debtors and a protect-ward; the action (`encounters.ts:1025`) picks by `o.allianceId === t.allianceId`. A loner nursing their ward instead treats a random loner stranger; an allied ward is never treated. This is likely part of why treat-downed succeeds only 12 %. Fix: `nursingPatients(...)[0]`.

**E4 — P2 — Confirmed — Third-party-truce cost is dead code.** `objectives.ts:574-578` searches `visible` for alliance-mates, but `visible` (`:508`) already excludes them, so `OBJECTIVES.thirdPartyTruceCost` is never charged. Fix: iterate the hunter's actual allies.

**E5 — P2 — Confirmed — A rescue promise can never be `broken`.** `obligations.ts:257` marks it kept the instant the promiser is together with a downed ally; `couldHave` at expiry requires exactly that, so it is always consumed. When the ally goes down and dies while the promiser is away, `:188-191` sets `lapsed` silently. Fix: track `wasDownedDuringWindow`; mark `broken` (and log it) if the promiser was within one hop and active.

**E6 — P2 — Confirmed — What-if branches drop the player's own interventions.** `whatIf.ts:55-66` / `gameStore.ts:1432-1459`: parachutes and live Gamemaker events are not in `plannedInterventions`, so branches from before them are compared to a reality that had them. Fix: record player actions with their cycle and replay them; at minimum label the panel.

**E7 — P3 — Confirmed — The #95 bloodbath alliance gate never runs.** `phases/alliances.ts:465-466, :1263`: `processAlliances` is not called in the bloodbath phase (`simulator.ts:125` vs `:181`), so `allianceFormationAllowed` is always true where read. Its early return in `declareLovers` is also counted by callers as a declaration (`++declared`).

**E8 — P3 — Plausible — Career pack merges unrelated pact pairs.** `phases/bloodbath.ts:134-149`: pairs A–B and C–D become one pack; the over-cap `shuffle().slice` can split a pair. Fix: connected components, take the largest.

**E9 — P3 — Confirmed — A Career whose only mutual pact is with a non-Career gets no group.** `bloodbath.ts:213` excludes Careers from `initializePactAlliances`, and the Career pack now needs a Career pact.

**E10 — P3 — Plausible — Run-to-end deep-clones the whole state every phase.** `gameStore.ts:1368-1369` calls `snapshotState` (structuredClone including the log) each advance, keeping only 16. Fix: snapshot only the final N phases, or exclude the log.

**E11 — P3 — Plausible — `runWhatIf` can read a different run.** `gameStore.ts:905-917` awaits between branches and uses the `gameState` captured at start; starting a new Games mid-debrief mixes runs. Fix: capture a run id and abort on `clearRewind`.

**E12 — P3 — Confirmed — What-if can only branch from the last 16 phases** (`REWIND_CAP`), and the panel does not say so.

**E13 — P3 — Confirmed — Balance fingerprint misses replay-breaking changes.** `balanceFingerprint.ts:30-36` hashes only `data/balance.ts` objects. Item/trait/archetype tables and flavour pool *sizes* (which drive `pickText` RNG draws) are excluded; #95's flavour rewrite changed RNG streams without a mismatch. #96 added an RNG draw in generation too, so pre-#96 seeds roll different casts.

**E14 — P3 — Confirmed at runtime — Dead alliances linger up to two phases.** Empty records (e.g. `floor-pact-d3-male` after both died in the bloodbath) persist until the next `processAlliances`. Fix: prune in `checkDeath` or at phase end.

**E15 — P3 — Confirmed — `proficiency.ts:157-159` pushes `'ranged'` twice** for thrown weapons.

**E16 — P3 — Confirmed — Mercy is remembered forever.** `sparedBy` is never aged, so "Mercy withdrawn" fires even after the pair allied and one betrayed the other — two contradictory headline beats for one death. Also, the mercy trust/regard gain ignores existing vengeance (`hasVengeanceAgainst`).

**E17 — P3 — Check — Backstory seeding may undercut the district-partner floor.** `seedBackstoryRelationships` runs after the floor in `generator.ts`; the comment says the floor outranks everything.

### 3.2 UI

**U1 — P1 — Confirmed — Header unreadable in dark mode.** `App.tsx:254-258` uses `bg-[var(--ink)]`, which dark theme turns cream (`index.css:212-230`); title is `text-white`, nav is hard-coded `#a89a86`. Same on the mobile bottom nav (`GameScreen.tsx:978`) and the setup hero. Fix: theme-stable `--chrome-bg`/`--chrome-ink` tokens.

**U2 — P1 — Confirmed — Broadcast bar covers the header on phones.** `BroadcastBar.tsx:101` sticks at `top-[3.75rem]`, but the header wraps to 211 px at 380 px wide; the 330 px bar overlaps the nav and, with the bottom nav, leaves ~250 px of content. Fix: measure header height into a CSS variable, collapse the bar to one row below `lg`, compact the header into a menu.

**U3 — P1 — Confirmed — Escape closes every stacked dialog.** `useDialogFocus.ts:34-37`: `stopPropagation` on a window capture listener doesn't stop other window listeners, so Escape in the command palette also closes the tribute sheet; focus falls to `<body>`. Fix: module-level dialog stack; only the topmost handles keys; restore focus only to connected elements.

**U4 — P1 — End-screen evidence links lose day/phase.** `App.tsx:395-400` sets the hash with a query, then `setView('chronicle')` makes the router push a bare `#/chronicle`; `ChronicleScreen.tsx:107` opens at page 0. Fix: `setView(view, query?)`.

**U5 — P1 — Palette tribute pick does nothing on End / Victor-interview.** `App.tsx:322` suppresses the app-level modal whenever `view === 'game'`, but `GameScreen` isn't mounted in `ended`/`epilogue`.

**U6 — P1 — "Within reach this Games" is a live spoiler.** `GameScreen.tsx:855-866` renders in-run near-misses, which the comment at `:670-680` says were removed for revealing the victor. Remove or gate behind spoiler-safe off.

**U7 — P2 — Confirmed — Command palette empty before a run** (`CommandPalette.tsx:63` returns `[]` when no gameState).
**U8 — P2 — Palette offers unreachable routes** ("Go to the roster" outside reaping; filter/zone actions go to `game` not `chronicle`; next-death navigates twice). Filter with `routeIsAvailable`.
**U9 — P2 — Palette listbox not accessible**: no combobox role / `aria-activedescendant`; active row scrolls out of the `max-h-[55vh]` list.
**U10 — P2 — Tribute sheet keeps stale tab/compare state** when the tribute changes (no `key={tribute.id}` at `GameScreen.tsx:1030`, `App.tsx:323`); can compare a tribute with itself.
**U11 — P2 — Save-slot note shows stale text** after discard/overwrite (`SetupScreen.tsx:505-520`, `key={i}` + `defaultValue`).
**U12 — P2 — "Discard" deletes a save in one tap** (`SetupScreen.tsx:533-541`); add confirm or undo.
**U13 — P2 — Mobile Proceed not disabled during Run-to-End** (`GameScreen.tsx:998`).
**U14 — P2 — Bottom nav ignores iPhone safe area**; add `viewport-fit=cover` and `env(safe-area-inset-bottom)`.
**U15 — P2 — Tribute sheet clipped by mobile toolbars** (`max-h-[88vh]` → `88dvh`).
**U16 — P2 — "New events" live region re-announces a growing total** during auto-play (`GameScreen.tsx:653-667`).
**U17 — P2 — Shortcut announcements lost on view switch** (announcer unmounts); move to App level.
**U18 — P2 — Tribute-sheet tabs are half-implemented ARIA tabs** (`TributeModal.tsx:733-745`).
**U19 — P3 — Arena key handler resubscribes every render** (`GameScreen.tsx:360-545`); read via ref.
**U20 — P3 — TributeModal / oddsLadder recompute every log line**; memoise, `React.memo` StandingsTable/DossierPanel.
**U21 — P3 — Seed input `focus:outline-none`** weakens focus visibility (`SetupScreen.tsx:570`).
**U22 — P3 — `useTransientFlag`** re-flashes when `resting` is an object literal (`useTransientFlag.ts:79`).

---

## 4. QOL, UI and UX improvements

**High**
- Compact mobile header (logo · coins · menu) and a one-row collapsible broadcast bar that expands for Undo/speed/export.
- One shared dialog manager: Escape stack, focus trap, `inert` background, body scroll lock (the page behind modals scrolls on touch today).
- Palette useful everywhere: New game, Resume slot N, Hall of Fame, Settings, spoiler toggle; grouped results with match highlighting.
- Persistent "saved / not saved" chip (`persistenceMode()` already exists).

**Medium**
- Merge the two "Compare with" controls in `TributeModal` (`:478`, `:715`).
- Confirm/undo for Discard slot, Reroll cast, and Play Again with open bets.
- Deep-linkable chronicle filters (`tribute`, `zone`, `q` in the hash).
- Show "Map unlocks at the bloodbath" instead of hiding the tab; phase-aware keyboard hints hidden on touch (`(hover: none)`).
- Focus the screen heading on route change for screen readers.
- Sticky table headers offset by the chrome height variable.
- "Jump to latest" / scroll-to-top on long mobile lists; swipe paging in the chronicle.
- **Follow-cam:** pin up to three tributes and auto-filter the feed to beats involving them, with a "their day" summary card per phase.
- **Why did they do that?** Every decision explanation already exists; surface a one-tap "reasoning" chip on each beat.
- **Session recap on resume:** "Previously: Day 4, 9 alive, Rue and Thresh allied…".

**Low**
- Tokenise hard-coded colours (`#a89a86`, alliance palette at `GameScreen.tsx:616`, `text-white`) and run contrast checks in both themes.
- One-time notice when auto-fullscreen fires; rich save-slot cards (relative time, rename).
- Colour-blind-safe alliance palette option; reduce-motion respect for cannon/flash effects.
- Bundle split: the main chunk was ~2.8 MB raw in AUDIT-10; lazy-load `arenaFlavor.ts` (15k lines) per arena.

---

## 5. Tribute logic — robustness and complexity

**Remove omniscience (P2).**
- The hunt score (`objectives.ts:531-548`) reads live `health`, `inventory` and `zone` despite its comment. Use the hunter's last-sighting snapshot and decay confidence with age.
- `endgameEdge` (`objectives.ts:245-265`) averages the exact field health/kills/weapons. Use public information (cannons, notoriety, sponsor drops seen) plus own memory.
- Betrayal targeting (`phases/alliances.ts:30-37`) knows hidden items exactly and ignores pack reaction. Use observed inventory and weigh witnesses.

**Fix dominated choices.**
- Convergence rung (`offer(99)`) overrides fear; add the same `huntAbandonFear` check the normal hunt uses (`:513`) so a terrified loner flees instead of walking into the Career.
- Convergence/finale targets are first-in-roster-order (`:313`, `:343`) → low district ids are targeted systematically. Score by weakness, fear, grudge, and truce.

**Add depth.**
- **Plans with memory:** a 2–3 step plan (e.g. "reach the river, fill water, return to camp") that survives interruptions instead of per-cycle objective re-rolls.
- **Deception as an action:** leave false trails, fake a camp, feign a wound to bait (pairs with the underused Baiting stance).
- **Risk profile that moves:** fear/desperation curves from hunger, wounds and alive-count so late-game behaviour shifts (hoarders turn predators, pacifists break).
- **Stance rebalancing:** Evasive 43 % and Aggressive 28 % dominate. Give Scavenging/Tending/Patrolling/Baiting clear trigger conditions (hunger, allied wounded, owned camp, trap stock) and explicit payoffs, and add a stance-diversity guard to metrics (target: no stance > 30 %).
- **Skill use, not just skill checks:** tracking should produce footprints others can read; crafting should make items appear in inventories (snares, spears, shelters) with durability.
- **Night behaviour:** distinct sleeping/watch rotations inside alliances, with watch failures as an event source.

## 6. Relationships and alliances

- Fix E1–E5, E7–E9, E14, E16 first — they are the alliance system's integrity.
- **Alliance roles:** leader, scout, medic, provider, watch — assigned from traits/skills; role neglect erodes trust, role success builds it.
- **Shared-resource ledger with fairness:** who ate what; unfair splits generate resentment and are a betrayal motive visible in the ledger UI.
- **Alliance splits with factions** rather than single defections: two members side with the leader, two leave together.
- **Relationship arcs:** rivals-to-allies through a shared rescue; allies-to-rivals through a witnessed theft; romantic tension that can be performed for sponsors (Showman/Charismatic) vs genuine (hidden `sincere` flag revealed at the end).
- **Grief and vengeance scaling:** losing an ally raises vengeance proportional to bond strength; high-bond grief can cause a "reckless" day or a "shutdown" day.
- **Promises as first-class objects:** "I'll come back for you", "split the sponsor drop", "last two, we part ways" — with kept/broken tracking (E5 makes this currently impossible to break).
- **Treat-downed success (12 %) and hearings (39 %) are low** — fix E3 and measure again before tuning.
- **Cross-district bonds from training** that seed alliances weighted by shared training stations.

## 7. Arenas — robustness and complexity

**Thin arenas to deepen first** (unique death causes / mutts / ambient lines):
- labyrinth 20 / 4 / 8, nooneplace 20 / 5 / 8, storywood 21 / 5 / 8, kelvin 22 / 4 / 8.
- warren has only 2 mutts; canopyweb, craterfield, seapeaks, acousticforest and burnscar have 3 mutts and 5 ambient lines.
- Procedural biomes steppe, saltmarsh, boreal, bayou and badlands have **no biome mutts**.

**Shared upgrades**
- **Arena phases:** every arena gets a 3-act transformation (e.g. Frozen Wasteland: thaw → flood → refreeze) keyed to day and alive-count, changing zone edges and hazards.
- **Zone state:** resources deplete and regrow; zones gain "scarred" states (burnt, flooded, collapsed) that persist and change what can happen there.
- **Weather layer** shared across arenas (fog, heat, storms) interacting with traits (Frost-Born, Heat-Bred, Night-Sighted).
- **Cornucopia refills and a second, hidden cache** discoverable by Cartographer/Tracker types.
- **Arena-signature achievements** (tide turn, second sun…) — none exist today.
- **Hazard telegraphs:** 1-cycle warnings that clever tributes (Reads The Sky, Watchful) react to — rewarding intelligence without omniscience.

**Arena-specific briefs (examples)**
- *Green Labyrinth:* walls that rotate nightly; dead ends; chalk marks tributes leave and others follow or falsify.
- *Nooneplace:* sectors that "forget" who entered them — memory of sightings decays faster here.
- *Story Wood:* scripted fairy-tale tableaux (the cottage, the well, the tower) with bait/ trap resolution.
- *Station Kelvin-9:* oxygen budget per module, bulkhead doors that seal on breach, cold-soak zones.
- *The Warren:* burrow collapses, add two mutts (tunnel hounds, blind burrowers).

## 8. Side features

Shallowest by size: `audience.ts` (20 lines, one function), `campaign.ts` (53), `VictorInterviewScreen` (57), `personas.ts` (67), `apprenticeship.ts` (62), `reunion.ts` (65), `veterans.ts` (87), `whatIf.ts` (91).

- **Audience model:** excitement should decay, have segments (bloodthirsty/romantic/underdog fans) and feed sponsor pricing and gamemaker boredom.
- **Victor interview:** questions drawn from the victor's actual log (kills, betrayals, lost allies), with answer tones set by traits; answers affect campaign reputation.
- **Campaign:** victors become mentors with measurable effects; district reputation carries across seasons; rival victor feuds; Quell rules announced a season ahead.
- **Apprenticeship/reunion/veterans:** give each a playable moment (choose a mentee trait to pass on; reunion scenes that alter next reaping).
- **What-if:** fix E6/E11/E12, then allow "what if X had not been reaped" and "what if this alliance never formed".
- **Betting:** add parlays across Games in a campaign and a bankroll leaderboard in the Hall of Fame.
- **Personas:** expand past warm/cold into 6–8 interview personas that influence sponsor blocs.

## 9. More ways to die

Existing codes (26): tribute, bleeding, infection, sepsis, poison, shock, dehydration, starvation, exhaustion, hypothermia, heatstroke, burns, asphyxiation, exposure, status, nightlock, self-inflicted, drowning, fall, collapse, border, trap, machinery, hazard, mutt, gamemaker.

**Housekeeping first:** authored events carry an optional `code?` that none set; 853 of 1,337 cause strings classify statically as `unknown`. Tag them in data so the cause chart is truthful without relying on runtime mapping.

**New universal causes** (usable in every arena)
| Cause | Code | Trigger |
|---|---|---|
| Allergic reaction to foraged food | poison | low forage skill, unknown plant |
| Crushed in a stampede at the Cornucopia | collapse | bloodbath, ≥8 at the horn |
| Own trap | trap | Trapper who is exhausted or night-blind |
| Weapon failure (spear snaps, bowstring whip) | machinery/tribute | crafted weapon at low durability |
| Choking on rations | asphyxiation | Starved + Hollow Leg / eating fast |
| Sleepwalked off a ledge | fall | Insomniac/Sleepless, high verticality zone |
| Lightning strike | burns | storm weather, high ground |
| Tetanus from a rusty wound | infection | rust-bearing arenas, untreated 3 days |
| Heart gave out from fear | shock | Skittish/Fragile, mutt encounter |
| Poisoned by a sponsor "gift" (Capitol tampering) | gamemaker | Gamemaker agency, unpopular tribute |
| Killed by an ally over the last ration | tribute | starving alliance, low trust |
| Smoke inhalation from own fire | asphyxiation | Kindler/Pyromaniac in enclosed zone |

**New arena-specific causes**
- *Labyrinth:* crushed between shifting walls; starved lost in a dead end.
- *Kelvin-9:* decompression; CO₂ build-up in a sealed module; frozen to a hull.
- *Story Wood:* ate from the gingerbread cottage (nightlock-like); pricked on the spindle (sleep → exposure).
- *Nooneplace:* walked into a sector that erased the way back (exposure).
- *Warren:* burrow collapse (asphyxiation); tunnel hounds (mutt).
- *Salt Mirror:* blinded by glare then walked into brine pools.
- *Clockwork Island:* caught in a tidal hour; gear-train crushing.
- *Menagerie:* released enclosure animals; poisoned water troughs.
- *Carnival:* hall of mirrors fall; rigged ride collapse.
- *Vault:* sealed in a timed chamber.

## 10. More events

**Universal**
- *The Mimic:* a tribute's voice is imitated by a mutt, luring allies.
- *Sponsor bidding war:* two patrons contest a single parachute; whoever reaches it first.
- *False feast:* announced feast with nothing at it — trap for the greedy.
- *Night of names:* the sky projects a fallen tribute's family; willpower checks or breakdown.
- *Arena shrink pulse:* one sector closes permanently at random.
- *Borrowed fire:* a tribute finds a still-warm camp; loot it, wait for the owner, or ambush.
- *Truce of the wounded:* two downed enemies in one zone; mutual aid or a crawl-fight.
- *Old victor's cache:* a hidden kit from a previous Games (campaign-aware).
- *Echo of a mentor:* a sponsor note with advice that's either right or deliberately wrong (Gamemaker agency).
- *Paranoia night:* everyone's sightings are fogged; allies may attack each other.

**Arena-specific:** each thin arena in §7 should gain 6–10 authored events tied to its transformation phases, plus one multi-day chain (setup → complication → resolution) per arena — e.g. Kelvin-9 "reactor leak" over three days, Labyrinth "the minotaur walk", Story Wood "the tower and the rope of hair".

## 11. Trait and archetype balance

**Measured (400 runs; indicative, guards abstain at this n):**
- Career 10.7 % win rate vs field mean 5.3 %; Career victors 62 %.
- Top: career 10.7, mercenary 9.6, opportunist 7.6, duellist 7.5, courier 7.4, captor 7.4, tracker 7.4.
- Bottom: martyr 2.2, understudy 2.4, broker 2.4, debtor 2.6, scavenger 3.0, saboteur 3.2, confessor 3.3 (shortest life, 4.0 days), penitent 3.4, ghost 3.5, survivalist 3.6, scholar 3.6.
- Signatures that rarely fire: confessor 33 %, cartographer 36 %, broker 36 %, courier 38 %, ghost 38 %.
- Traits over the mean: Light Sleeper 11.2 %, Shared-Burden 10.5 %, Brute 9.5 %, Lightfooted 9.0 %, Stoic 8.9 %, Broad-Backed 8.7 %, Hoarder 8.3 %.
- Traits under the mean: Trapper 2.2 % (n=680, forced on D3), Spoken For 3.0 %, Bookkeeper 3.1 %, Steadfast 3.5 %, Cool-Headed 3.6 %, Devout 3.6 %, Broker 3.8 %.
- Modifier outliers: Hardened (3.9 sd combat), Unremarkable (3.2 combat), Waterborn (3.2 survival), Dead-Eyed (2.8 social), Quiet Room (2.7 social), Slow Burn (2.8 survival).

**Recommendations**
1. **Career share:** the volunteer academy kit (#96) plus the pack likely compounds. Try (a) Career pack infighting pressure scaling with alive-count, (b) weaker academy kit coverage (fewer weapon classes), (c) a notoriety target bonus that drives the field to hunt the pack. Gate at 1,600 runs.
2. **Confessor** dies first: give it a protective social mechanic (confession grants a one-time truce) instead of a pure exposure risk.
3. **Martyr / Understudy / Debtor:** their payoffs trigger on others' outcomes. Give each a personal survival hook (Martyr: survives the first sacrifice with 25 % chance and gains Unbroken; Understudy: inherits an ally's objective and gear on death).
4. **Trapper** at 2.2 %: E3-style fixes won't help; traps need yield. Make snares catch food as well as tributes and let traps be checked remotely.
5. **Light Sleeper / Stoic / Brute:** nerf the flat modifiers by ~20 % and remeasure.
6. **Hardened / Unremarkable:** cap combat modifier magnitude at 2 sd.
7. **Trait/archetype name collisions** (Tracker, Scavenger, Quartermaster, Broker, Strategist are both): rename traits or show a "trait" / "archetype" badge everywhere.
8. Add a **district fairness guard**: no district > 15 % crowns in the default config (D1 is 23 %).

## 12. Replayability

- **Seasons with a meta-arc:** a rebellion meter across a campaign that changes Quell rules, sponsor behaviour and Capitol cruelty.
- **Modifiers/mutators deck:** draw 2 per Games (no Cornucopia, double feasts, blind night, all-volunteer, mutts-only kills count).
- **Daily seed** with a shared leaderboard of predictions (who wins, first death, cause mix).
- **Prediction mode:** before the bloodbath, rank the final 8; scored at the end, feeding meta achievements.
- **Director personalities:** Gamemaker personas already exist; make them mechanically distinct (one loves mutts, one loves fire, one loves alliances breaking).
- **Legacy tributes:** a Hall of Fame victor can be reaped again in a Quell with their earned traits.
- **Rarity surfacing:** when a very rare beat fires, badge it ("seen in 0.3 % of Games").
- **Anti-staleness in text:** measure line reuse per session and suppress repeats within N days.

## 13. Shallow or incomplete features

- Stances beyond Evasive/Aggressive (see §5).
- Crafting (items rarely created and never degrade).
- Treat-downed (12 % success) and alliance hearings (39 %).
- Rescue promises (can't break — E5).
- Third-party truce cost (dead — E4).
- The bloodbath alliance gate (dead — E7).
- Audience, personas, victor interview, apprenticeship, reunion, veterans (§8).
- Procedural biomes without mutts (§7).
- Cause codes on authored events (§9).
- What-if replay fidelity (E6, E11, E12).

## 14. New achievements

Checked against the 388 run + 22 meta titles; none duplicate.

| Title | Category | Trigger |
|---|---|---|
| Loner's Handshake | social | two unaligned tributes form a truce after convergence (needs E1) |
| Promise Broken | social | a rescue promise is marked `broken` (needs E5) |
| Wrong Patient | oddity | Nursing tends a non-ally while an ally bleeds |
| Two Packs, One Horn | combat | two separate Career packs clash in the bloodbath |
| The Tide Turned | arena | victor survived their arena's signature transformation |
| Stood the Second Sun | arena | survived the Solar Desert signature |
| Nothing in the Walls | arena | won the Labyrinth without a wall-shift death witnessed |
| Deck of Rules | games | Games ran with 2 mutators and a non-Career won |
| All Twelve Stances | oddity | one tribute used 8+ distinct stances in a Games |
| Patient Zero | survival | survived an infection that killed a treater |
| The Last Ration | social | shared food on the day the alliance was starving |
| Bait and Switch | combat | a kill from the Baiting stance |
| Walked the Perimeter | arena | Patrolling stance across every zone edge |
| Carried the Wounded | survival | Tending stance kept an ally alive three days |
| Beastmaster | combat | three mutt kills in one Games |
| No Beast Touched Them | survival | won in an arena with 5+ mutt deaths, never mutt-wounded |
| Starved Out | games | 3+ starvation deaths in one Games |
| From the Eleventh | reaping | a D11 victor (the rarest district) |
| Unrecorded Cause | oddity | a death by a newly added cause type (§9) |
| The Unlikely | reaping | a bottom-five archetype wins |
| Twice Forgiven | social | spared twice by the same tribute |
| Mercy Returned | social | spares the tribute who once spared them |
| Seen Nothing | oddity | a victor with zero sightings recorded of them |
| Out of Order | games | the lowest-rated training score wins |
| **Meta:** Every Archetype | meta | a victor of each of the 36 archetypes |
| **Meta:** Every Death | meta | seen each of the 26 cause codes |
| **Meta:** Ninety-Nine Seeds | meta | 99 distinct seeds completed |
| **Meta:** No Career Season | meta | 5 consecutive Games without a Career victor |

## 15. New first names (no surnames)

All verified absent from `src/data/names.ts` (grep, whole-word).

- **D1 (luxury):** Solenne, Sienna, Tesla
- **D2 (masonry):** Rook, Gneiss, Tuff, Pumice, Slate, Scree
- **D3 (technology):** Rivet, Gasket, Axle, Cog, Flywheel, Ferrous
- **D4 (fishing):** Coble, Galley, Rigg, Sprat, Dace, Tench, Burbot, Gudgeon, Samphire, Dulse, Wrack, Laver
- **D5 (power):** Henry, Bellows
- **D6 (transport):** Tongs, Brisk
- **D7 (lumber):** Hawthorn, Gorse, Heath, Cairn, Siskin, Caddis, Mayfly
- **D8 (textiles):** Tussah, Madder, Woad, Sepia, Abacus
- **D9 (grain):** Millet, Teff, Barley, Rye, Kasha, Caraway, Lovage, Chervil, Borage, Clary
- **D10 (livestock):** Heifer, Ewe, Lambkin, Colter, Hayward, Plowman
- **D11 (agriculture):** Hedger, Thatch, Wattle, Daub, Lark, Plover
- **D12 (mining):** Tarn, Loess, Sleet, Pewter, Cooper, Wright
- **Neutral:** Dunlin, Curlew, Tern, Ashby, Pell, Roach

Also: add a `test:names` rule that rejects any entry containing a space, hyphen-surname pattern or a second capitalised word.

## 16. New traits, skills, archetypes

**Traits (non-duplicate)**
| Trait | Effect |
|---|---|
| Night Owl | +stealth/+tracking at night, −day endurance |
| Salt-Tongued | lies detected less, but truth believed less |
| Bone-Setter | treat-downed success +25 % |
| Heavy Sleeper | full rest recovery, −watch detection |
| Pack Rat | +1 carry slot, noise penalty |
| Forgets Faces | grudges decay twice as fast |
| Oathkeeper | cannot break promises; allies trust +10 |
| Glass Jaw | −shock resistance, +dodge |
| Firewalker (rollable) | burns resistance, −cold |
| Wanderlust | moves more, finds caches more, found more |
| Homebody | +defence in the first zone they camp in |
| Mimic | can imitate voices (lure event) |
| Cannon-Counter | tracks alive count exactly; +endgame planning |
| Sponsor's Pet | +parachute chance, −ally trust (envy) |
| Twitchy Trigger | first strike always, accidental ally hits |
| Weather-Nose | 1-cycle hazard telegraph always read |

**Skills (new proficiencies)**
- **Navigation** — shortest paths, avoids hazards, feeds Cartographer.
- **Cooking** — food yields more, lowers poison risk from forage.
- **Deception** — false trails, feigned wounds; counters tracking.
- **Watchkeeping** — alliance night watch success.
- **Animal handling** — mutt pacification and livestock arenas (Menagerie).

**Archetypes (pilot four)**
- **The Hermit** — refuses alliances, camps deep, wins by outlasting; signature: "the arena forgets them".
- **The Showrunner** — performs for sponsors, stages fights between others; signature: an orchestrated duel.
- **The Healer-Pacifist** — never kills; alliance magnet; signature: saves an enemy.
- **The Saboteur-Engineer** — rigs the Cornucopia / arena machinery; signature: an arena hazard triggered by their hand.

## 17. Implementation order

1. E1–E5 with a shared `allied()` helper and lint rule; U1–U6.
2. Remeasure at 1,600 runs (stances, treat-downed, hearings, Career share) before tuning.
3. Career/district balance (§11) behind guards; stance-diversity guard.
4. Omniscience removal (§5).
5. Cause-code tagging, then new causes and events for the thinnest arenas.
6. Side-feature depth, replayability mutators, achievements, names, traits and archetypes.
