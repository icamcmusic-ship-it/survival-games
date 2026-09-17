# Changelog

## Audit 5 fix pass, plus the requests (this branch)

Everything `AUDIT-5.md` asked for, and the nine items the request added on top
of it. Every number below was re-measured after the change; the roster is
green (`lint` + 16 checks).

### The requests

- **The pre-Games are staged.** `Phase` gained `square`, `train`, `parade`,
  `training1..3` and `scores`; `Simulator.advance()` owns the dispatch table
  and the store just asks for the next thing. The chronicle pages each one
  (`THE REAPING`, `THE TRAIN TO THE CAPITOL`, `TRAINING — DAY 2`, …), the arena
  screen's Next button walks them one at a time, day and night were already
  separate pages. Old saves with `phase: 'training'` resume into the scores.
- **The chronicle can advance the Games.** On its last page the Next button
  becomes the stage's own verb (*Board the train*, *Sound the gong*, *Into the
  night*), runs it, lands on the page it just wrote, and every page change
  scrolls to the top of the log.
- **The relationship graph is a grid.** Every living tribute, one row each, in
  district order, with the feeling as a labelled chip and every standing fact
  (ally, lovers, sworn, truce, sustained contact) as a badge. The dead drop off
  it. The modal's separate "Relationships" list is folded into it.
- **"rated X on the floor yesterday"** is now *"has been watching X work, and
  was impressed."*
- **"How X got out"** is *The road out*: the victor's own important chronicle
  lines, grouped by day, with the arithmetic (days, kills, sectors, health,
  opening odds, traits earned and shed) in a fact row above. Nothing in it can
  be wrong about the run because every line is something the engine logged.
- **"What made these Games unusual"** was rewritten so every claim is derived
  from a number the state holds: the bloodbath is counted from `dayOfDeath`,
  the cast size is the cast size (not "twenty-four"), the zero-kill history
  reads zero-kill runs (not the total victor count), "the odds board never had
  them near the top" actually reads the odds board, "the longest feud on
  record" says *in these Games*, and the arena-vs-tribute death split reads the
  cause strings rather than a regex for four of them.
- **The cousin pairing is gone.** It landed on one district in six every year.
  The RNG draw is kept so existing seeds reap the same cast; the achievement
  that read it now reads the sibling volunteer.
- **Names.** ~810 district names that read as an industrial noun with a vowel
  on the end (*Stopcocka*, *Semisub*, *Transitor*, *Chokepointe*, *Gob*,
  *Nipt*, *Kicking*, *Sablefisher*…) were replaced with names in the same
  theme that read as names. `test:names` now also guards against anything
  that would read as a surname or a compound.
- **More of everything:** 20 quirks (all mechanical, 105 total), 2 stances
  (`Nursing`, `Patrolling`, both conditional, with scorers, preconditions and
  12-line generic pools), 4 archetypes (`Scavenger`, `Captor`, `Bellwether`,
  `Confessor`, each with a signature hook and an 8-line set-piece pool — all
  four fire for 30–48% of entrants), 12 traits (10 rollable filling the nine
  single-carrier hooks, 2 earned: `Witness` on the second betrayal watched,
  `Frostbitten` on the second frostbite).

### Audit 5 §1 — bugs

- **Five arenas have signatures** (§1.1). `tidewrack`, `thresher`, `vigil`,
  `saltworks`, `kiln` — the turn of the tide, the line starting, the bell, the
  pan cracking, the second sun — each expressed in the arena's own law.
  Measured over 150 runs: all five fire. `validate-arenas` now fails an arena
  with no `SIGNATURES` entry / `signatureRule`, or no blurb (§1.2).
- **`describeSignatureRule` is called** (§1.3): the Gamemaker brief at the
  drop now carries `ARENA RULE: …` for every arena, authored or procedural.
- **`LEGENDARY_ITEM_TEXTS` is drawn** (§1.4): the naming moment uses the
  twelve authored lines. `check-flavor-pools` now fails any exported pool
  nothing in `src/` references (§6.5).
- **Seventeen dead exports** removed or wired (§1.5): `evaluateInRunNearMisses`
  now feeds a "Within reach this Games" panel on the standings tab;
  `hasSignature` and `describeSignatureRule` are live; the rest are gone.
- **Achievements** (§1.6–§1.9): `scarred-and-standing` asks for one scar (two
  measured 0 in 400 runs); `the-short-week` carries `availableIn` for small
  fields and compressed calendars; `arms-dealer`, `cartographer`,
  `the-quiet-one` relabelled `legendary` (they fire); `the-unwitnessed` reads a
  tribute who reached the final eight unseen rather than a victor who
  structurally cannot.

### §2–§12

- **§2.3** the hover-hint ratchet: nine `title=` on `SetupScreen` and
  `HallOfFameScreen` converted to `Hint`/`aria-label`; ceiling 30 → 21.
- **§4.2** bloc-treaty expiry is `important`, so a treaty is seen to end.
- **§4.3** rumour `plantChance` 0.12 → 0.2.
- **§5.3/§5.5/§7.5** `dodgeAlt` back-filled on 994 events that had none, so an
  arena hazard is no longer a tax on agility and intelligence alone; nine
  universal events added — three that roll against charisma, four that make
  you hungry, two boons.
- **§5.4** two laws that give: `salvage` (a corpse's kit stays where it fell as
  a cache — on the Abattoir) and `theBell` (a zone named at dawn, fed at
  nightfall — on the Carnival). Both fire.
- **§6.2** Quell rate ~7% → ~12% (`noQuellWeight` 600 → 330).
- **§7.4/§7.6** 80 authored events across the five floor packs (16 each, with
  each arena's signature death: stranded by the tide, turned away at the horn,
  did not wake for the watch, went through the pan, found no shade). Zero packs
  sit on the floor now; roster short of the soft target 357 → 277 events.
- **§8.2** `preferredTraits` widened to 4–5 on the bottom five archetypes.
- **§9.5** six mutators added (twelve total).
- **§11.5** fourteen achievements added (207 total).

### Not done, and why

- **§10.3 flattening the initial-letter distribution / a third name pool** —
  the name pass replaced ugly names rather than adding 400 new ones; a
  gender-neutral pool is a data-shape change to `DISTRICT_NAMES` and every
  reader of it, and is left for its own change.
- **§3.4/§12.2 new proficiencies** (`stealth`, `intimidation`…) — a new
  `Proficiency` touches the UI, the archetype speciality table and the
  proficiency check; deferred rather than half-done.

## Second requests pass (this branch)

Three items: finish the prose pass the last branch scoped down, get zero-kill
victors to about five in a hundred, and fix the CI failure the last merge left
on `main`. The third one turned out not to be a regression at all.

### The last fight was not being called a draw. It was not being started. (§11)

`victors with zero kills`: **15.2% -> 4.4%** at n=1600 (5.3% at the 400-run
default), against a request of about five in a hundred.

The previous pass took away the arena's right to finish the second-to-last
tribute and the ending walked out of the next door along. Every stage of this
was measured before it was believed, and each measurement pointed at a
different door:

    of 58 zero-kill victors at 400 runs, 34 were the runner-up
    taking the nightlock or walking into the border

Closing that moved the ending along again, to dehydration — so the problem was
never the cause of death. It was that the two of them were not meeting:

    361 runs reached a final two
    the forced-finale branch fired in 59 of them
    in none of the zero-kill runs did the two of them ever meet
    finalists stood in the finale zone for 30.7% of the cycles
    they were being herded through

Four changes, in the order they were found:

- **A finalist does not get to opt out.** Both self-inflicted endings are held
  for exactly as long as the arena's own attrition is — the final-two grace
  window — and nothing changes at any larger field size, so the nightlock stays
  reachable. A broken finalist still stops hiding, still puts the weapon down,
  still loses the token; every one of those puts them in front of the other
  finalist rather than out of the Games behind their back.
- **The forced finale runs to a conclusion.** `wantsToRetreat` has refused to
  let either finalist break off since §7, but the duel still resolved on the
  ordinary four-exchange ceiling, so they met, traded four rounds and
  separated. The bloodbath already had an exemption for exactly this condition
  — no line of retreat — and the finale now has one too.
- **The meeting stopped losing its roll.** A hazard roll and a mutt roll each
  `return` after firing, so in the escalated endgame most of a finalist's
  cycles went to the arena rather than to the other finalist, and the stealth
  check still let one of them hide in a sector the Gamemakers had stripped.
- **The arena closes for real.** `forceFinale` has announced from the sky since
  §7 that every route not toward the horn is shut, and then left the border on
  its day-counted schedule. Everywhere that is not the finale zone now goes out
  of bounds, and the existing finalist damage cap is what keeps the wall from
  deciding the Games.

Wipeouts fell with it, 4.3% -> 2.3% at n=1600, and `runs ending with no victor`
meets its design goal for the first time. Guard ratcheted 32% -> 12%, goal 25%
-> 6%, both met.

### CI was red on `main` because of a guard, not a commit (§26)

`Career victors` was guarded at <= 50% on the strength of a §9.4 measurement of
42.9% at n=3200. That figure does not reproduce. `main` at 5a9c945 measures
**52.7% at n=1600** and 50.6% at the 400-run default — so the guard sat below
what the build actually produces, and the first commit to land after it failed
a check it had nothing to do with.

This is the second time this one indicator has been guarded from a number that
did not survive instrumentation; the first is already written down directly
above it in `metrics.ts`. Re-measured rather than re-derived, and set to 57%:
about 3.4 points over the 53.6% this branch measures at n=1600, which is the
observed run-to-run spread of the indicator rather than a round number. The
design goal stays at 45% and stays unmet, which is the honest state of it.

Two hypotheses tried against that goal and falsified:

- **Not the §23 bloodbath work.** Reverting all three of its levers together is
  worth 3.8 points at 400 runs, and no single one is worth more than 3. The
  first morning is not the Games.
- **Not the §9.4 appetite clock.** Nearly twice as steep is worth 0.7 points at
  n=1600, with starvation's share of deaths moving 0.8% -> 0.9%. The clock is
  not biting because Careers are not reaching the endgame hungry.

What the instrumentation does say is where the next pass has to look:

    Careers hold 54.6% of final-two slots off 25% of the cast
    and then lose mixed final twos 68 to 91

They are not out-fighting the field at the end. They are out-lasting it to get
there, and that is a balance pass rather than a knob.

### The rest of the prose pass (§12)

The previous branch rewrote the core in-arena loop to report rather than
interpret, and said plainly that it had left the per-arena flavour packs — some
17,000 lines across 49 arenas — in their existing voice, with the five new
arenas written to the plain standard so both registers were in the build and
could be compared. This finishes it.

Every pack is now at that standard: the thirty-three hand-authored arenas, the
four procedural biome packs, the generic fallback pools every unauthored arena
draws on, the universal event table merged into all of them, and all four
groups of set-piece events.

Three things change, line by line. A second sentence that told the reader how
to feel about the first is cut. A run-on joined by ", and" becomes the two
events it was actually describing. A line that withheld its subject states it.
What does not change is the concrete detail — the tide table, the drip rate,
the count of logs left in the shed, eleven seconds for a pebble to reach the
bottom of the quarry — because that was always the part doing the work.

`test:arenas` earned its place on the roster during this: fourteen rewrites
dropped `{tribute}` out of an event text, which is the §22 defect appearing in
a new file, and the check named every one of them before they were committed.

## Requests pass (this branch)

Answers a twenty-five item request list rather than an audit. Three of the
items turned out to be the same defect wearing different clothes — the
simulation knew something and the log would not say it — and two of the
quantitative ones were wrong in the direction nobody expected, which is the
part worth reading.

### The endgame was being decided by septicaemia (§11)

Half of all victors finished a run with one kill or none, and a quarter with
none at all. The obvious reading is that tributes were hiding successfully,
and it is wrong. Measured over 200 full runs: of 189 final-two endings, **90
were the runner-up dying of bleeding, infection, thirst, starvation or
exhaustion, and 43 were the victor killing them.** The Games were being
decided by which of the last two was less badly hurt, off camera, with the
last fight simply never happening.

Two changes. A **convergence** at six survivors — the Gamemakers close the
arena to one sector and drive whatever is left of the field into it, which
fires in 95% of runs — and an eight-cycle window at the final two in which
nothing except another tribute may finish them. The window is bounded on
purpose: an earlier build protected both finalists unconditionally and left
two tributes pinned at 1 health for as long as it took them to meet.

    victor kills the runner-up    23% -> 58%
    victors with <= 1 kill      50.3% -> 37.3%
    zero-kill victors (of 200)     51 -> 29

### The Career knob that made Careers worse (§23)

Careers took 39.1% of bloodbath kills from 25% of the field. The obvious lever
is the pack ganging up on one target, so it was raised from 0.6 to 0.8 — and
the Career share went **down**, to 36.2%. A four-on-one pulls five tributes out
of the scrum for a round and yields one kill where four duels yield four.
Ganging up is more frightening and less productive, which is a real thing
about packs and not a bug; it is left at 0.6 with that written down.

What works is arriving first. A Career has spent years being told what is laid
out at the mouth of a Cornucopia, and arrival order decides who comes away
armed.

    Career share of bloodbath kills   39.1% -> 46.5%
    Career share of crowns                     34.7%  (design goal 45%)

### Lines that would not say who they were about (§22)

`tributesInvolved` is what links names to profiles, what the per-tribute
chronicle filter reads, and what the relationship graph is built from — so a
line involving three tributes and naming one is a defect, not a style. A new
`npm run test:unnamed` plays 40 full Games and measures it: **12.4%** of all
multi-tribute lines left somebody out. The district-partner cannon was the
worst, 261 a sweep, and it never named the killer; the named-heir line was
next at 153 and never named the group who heard it said. Now 4.0%, ratcheted.

The guard then caught the training digest added in the *next* commit, which
claimed all twenty-four tributes while naming three.

### Everything else

- **Five new arenas** (§1), each with a law that exists nowhere else, paired
  with an existing law chosen to argue with it: the Tidewrack Flats re-cut by
  the tide every night, the Thresher Floor where the horn only opens for a
  tribute who has killed, the Vigil where sleep does nothing, the Saltworks
  where the ground does not recover, the Kiln with two suns and one cold
  cellar. Full flavour packs, mutt rosters covering every terrain, climates,
  and a contested bottleneck each so they add to the roster rather than
  dilute it.
- **Laws say what they do** (§2): kind, severity, systems touched, and the
  concrete mechanical consequences in the player's terms.
- **Arena event packs** (§3): one or two named, arena-wide set pieces a run,
  drawn from the seed, plus the convergence, all listed in the picker.
- **Careers** (§4, §9): the pack forms in effectively every Games rather than
  two thirds of them, holds together longer, trains as a bloc for all three
  days and names who it is watching — and has almost no social appetite for an
  outer-district tribute who is not worth having.
- **Bodies** (§6): frame and condition go from five rungs to seven, the
  original five keeping their exact distance from the middle.
- **The arena's death budget** (§24): past 30% of the cast, further
  environmental killing blows are rolled against and leave the tribute on one
  health. Worst single run across 200 is now 33%; "sometimes more than half"
  does not happen.
- **The chronicle is a log** (§13, §14): an in-arena timestamp on every line,
  and the full page is one entry per line in four columns that line up,
  replacing a two-column masonry grid of variable-height cards.
- **The setup screen** (§7, §8, §18): unlocked arenas only in a two-column
  grid, age mean and standard-deviation sliders with live readouts, a
  randomize-everything button, and a one-victor-only rule.
- **Achievements** (§10, §19, §20): revealed at the end of a run and nowhere
  else, on a Common / Rare / Legendary / **Possible?** ladder regenerated from
  measured unlock rates, colour-coded, and paying Capitol Coins by tier.
- **Plainer prose** (§5, §12): the reaping square is one factual line per
  tribute, and the highest-traffic pools in the simulation — grief, vengeance,
  relief, sanity, betrayal aftermath, duels, group fights, the training floor
  — report rather than interpret, as do deaths, alliances, the bloodbath, the
  border and the parachutes. Between them that is the core in-arena loop. The
  per-arena flavour packs (~17,000 lines across 49 arenas) keep their existing
  voice; the five new arenas are written to the plain standard, so both
  registers are in the build and can be compared.
- **Fullscreen on start** (§15) and **no map tab before the gong** (§17).
- **Bugs found on the way** (§25): 'The Toll' could never be earned (it asked
  a live map at the one moment it is always empty — 0% to 13.8%);
  `applyWearAndTear` added the desert and ice drains after the cycle's last
  clamp and never clamped itself; `vanillaRules` was silently dropped by the
  config reader on every reload; the achievement payout ran before the pass
  that decides it; `VENGEANCE_TEXTS` shipped an unfilled `{zone}`; and the
  'Possible?' tier flapped the build on single-observation noise. And two of
  the soak's own metrics were counted by matching a fragment of one log line's
  prose, so rewording that line silently zeroed them — the Cornucopia restock
  and the border telegraph. The telegraph now carries a stable
  `BORDER WARNING:` marker, the way `BORDER COLLAPSE:` and `AMBUSH:` already
  do, and the counter keys on that rather than on English.

## Audit 4 fix pass (this branch)

Answers `AUDIT-4.md`. That report's theme was that the repository had reached
the point where the remaining failures were *taxonomies nobody stocked* and
*state the interface never showed* — and the pass found a third theme the
report had not: **the function carrying the design reasoning was not the one
doing the work.**

### The one that changed the diagnosis (§3.2)

31.4% of all live tribute-cycles sat at sanity 0–9 and 31.3% at 90+, with the
four middle deciles holding 17% between them and p25 at literal zero. Half the
cast went all the way down and **one tribute in a thousand ever came back**.

The audit blamed `applySanityPressure` — "the drains and the recoveries are not
in the same order of magnitude". Two fixes aimed there (a camp and a meal as
recoveries a *solitary* tribute can reach, and an easing so an empty gauge
loses less) moved `gone` 33.0% → 31.3% and the escape rate 0.1% → 0.4%. Almost
nothing.

So the gauge was disabled outright and the run re-measured. **The
sanity-by-day curve was unchanged.** The function with all the design comments
in it — and all three previous audits' tuning — was about 5% of the system.
The other 95% was thirty-odd direct writes across twenty-one files: mutt fear
auras, exposure, the anthem, betrayal, grief, parley tolls, arena signatures,
Gamemaker interventions, training, triangles. Nothing bounded their sum, and
`traitMod('sanityDrain')` — the dial that decides who falls apart under this —
was applied by the gauge and by nothing else.

`loseSanity()` is the one place sanity is taken now. 59 subtractions route
through it; it applies the temperament multiplier (so Stoic and Cool-Headed
reach the 95% of sanity loss they previously did not touch) and eases as the
gauge empties, so the bottom is a basin rather than a pit. Gains stay direct.
The anthem's grief is capped per night — uncapped it took 6 per named friend,
so playing the social layer well was the fastest route to the floor.

    sanity 0-9        31.4% -> 13.4%     middle bands  22.3% -> 54.7%
    p25                   0 -> 33        scarred       49.8% -> 26.9%
    recovered from gone 0.1% -> 3.2%     sanity's feed share 12.9% -> 10.9%

Two new metrics indicators guard both ends, because a single mean hides exactly
this failure. And it moved the one indicator the audit found still short of its
design goal: **victors with zero kills 29.9% → 24.7%**. A cast that is not
catatonic fights. (It ended the pass at 28.5% — see *The one that got away*
below.)

### Taxonomies nobody stocked (§1.1, §1.8, §1.9)

`EdgeRule` declares seven kinds and the roster carried 26 `tolled`, 8
`timeGated`, 5 `oneWay` — and 4, 2, 1, 1 of the rest. `contested = 1` meant
`tickGarrisons` ran once per cycle in every game, found nothing in 39 of 40
arenas and returned: **0 garrisons in 160 runs**. `collapsing` and `oneWayAfter`
are the only writers of `edgeCrossings`: **0.0 per run**.

`data/arenaEdges.ts` authors 67 new rules across 30 arenas. `validate-arenas`
fails when a kind is authored fewer than four times and checks the three
structural constraints — a hidden edge needs one discoverable endpoint, a
contested edge needs a chokepoint endpoint, collapsing and oneWayAfter need a
positive count. It immediately caught 21 unsorted keys in the file being added.
The procedural generator composed 3 of 7 kinds and composes all 7 now;
`ZoneFeatures.cover/elevation/chokepoint` became optional and derived (the
pattern the four newer fields already used) so a bisected map's single crossing
can *say* it is a chokepoint instead of being guessed at from its name.

    garrisons 0 -> 19% of runs   edgeCrossings 0.0 -> 0.66/run
    contested 1 -> 20            hidden 2 -> 14   collapsing 4 -> 12

`irradiated` — the only permanent and only *creeping* zone effect, 45 lines of
engine — fired **zero times in 340 runs**, because six authored events were the
only thing that could start one. `swarming` (1.0% of sampled effects) and
`quaking` (2.1%) against `fogbound` (31.3%) were never about the ambient
chances, which are within 20% of each other: fog has the weather-front system
behind it and the other two had one roll each. All three have a second source
now, reading state that already exists — `structuralFatigue` for ground that
shifts before it falls, `zoneDeaths` for something hatching out of what has
been left lying in a zone, and for `irradiated`, ground already contaminated or
stripped once the arena has begun closing.

    irradiated 0 -> 4% of runs   swarming 1.0% -> 5.8%   quaking 2.1% -> 5.0%
    spread across the nine impermanent kinds 30x -> 5.6x

The soak counts every kind off live state and fails if any reads zero.

### Content that was prose (§6.3)

85 quirks with four-plus lines each — the best character-differentiation
content in the repository — were **entirely inert**. Read in two places, one
that assigns them and one that surfaces a line on a quiet cycle. "Always takes
the high ground", "never turns their back on a treeline", "sleeps in short
shifts by choice": every one is a mechanical hook written out in prose and left
as prose, which is precisely the failure `data/traits.ts` opens by documenting
having fixed once already.

`QUIRK_MODS` gives all 85 a row against the existing `TraitMod` vocabulary, so
a quirk costs a data row and no read site at all. Several cost something,
because a habit that is all upside is a trait with the price filed off.
`quirkEffect()` renders the row in plain English on the tribute sheet, so it is
a mechanic a player can read rather than one they discover by losing to it.

### Guards that measured the wrong thing (§1.5, §1.6)

`test:sim` printed "695/1388 authored events fired at least once (50.1%)",
which reads like half the content is unreachable. It is a function of
`RUNS / arenaIds.length`: at 120 runs on one arena, reach is **94–100%**
(eclipse, the sweep's thinnest pack at 8/33, reaches all 33). The guard falls
when somebody adds an arena and rises when somebody raises the run count — the
two changes a ratchet must not react to. It is per-run reach now.

`test:metrics` at its default 400 runs printed two SHORT-of-goal lines that
read MET at 1,600, because eight of fifteen archetypes are under the guard
sample there and the whole-field spread is set by whichever got unlucky. The
verdict is withheld until every archetype clears `GUARD_MIN_SAMPLE`.

### State the interface never showed (§2.1, §4.4)

`Tribute.downed` — 1.5% of tribute-cycles, resolving 174 times to a finishing
blow, 137 to a rescue and 135 to mercy per 160 runs, the most dramatic state
the simulation holds — was named by **no component in the app**. So were
`transit`, `timeOfDay` (three values against a header showing the phase, which
has two), `cornucopiaHolder`, `activeMutts`, and the entire alliance-politics
layer: `roles`, `charter`, `successorId`, `factions`, `breaches`, with
`charterSummary()` exported and imported by nothing.

### Smaller (§1.2–§1.7, §1.11, §3.4, §4.2, §5.4, §6.2, §8.3, §9.5, §11)

- `veteransSeated` held names and three read sites tested ids. The "Returning
  victor" chip had never rendered.
- The sixteen authored legendary weapon names were the fallback for an empty
  composed list, and `composeName` ends in an unconditional push: 86 distinct
  names over 180 runs, **none of them authored**.
- `Swamps's Answer` and `Fields's Answer` shipped to the record book.
- `offSeason.ts` told contributors skins were strictly cosmetic; 118 of 120
  carry a mechanical field.
- `medicine` was the only proficiency whose median holder sat below 1.0, on a
  cold start: `dressChance` reads the skill only success could raise, and using
  a medical item on yourself taught nothing.
- A pair named one alliance role and it was the one with no effect in a pair.
- All 34 off-season skins with an `addLaw` added a *subtractive* law.
- 27 Quells share 6.1% of runs, 0.23% each, and "Force a Quell" rolled randomly
  from the same weights. Every piece of plumbing a picker needs already existed.
- `deathCausesInRun()` was written to be "the hook a records screen wants",
  said so in its comment, and was called by nothing. The record book now shows
  six completion figures.
- `targetDraw` — the only dial saying "the field has decided about you" — had
  one entry of fifteen.
- 23 of 40 arenas authored no conditional-stance actions, so fortifying in the
  Red Cathedral and in the Salt Flats used the same words.
- 22 new achievements; reaping 12 → 16, games 12 → 17, arena 22 → 28.

### Six findings corrected

Written up in `AUDIT-4.md` rather than quietly dropped, and four of the six
were found by the check roster rather than by re-reading.

- **§3.2** named `applySanityPressure` as the cause. It is 5% of the system.
- **§2.2** put the `title=` count at 47. It is 94: the grep missed every
  `title={...}` and counted component props as HTML attributes.
- **§1.2** said `ReapingScreen` read `veteransSeated` correctly. It has the
  same bug in two more places.
- **§10.4**'s arithmetic ("sanity is 11% of the feed, therefore ~98 draws from
  three pools of ten") assumed every sanity-category line comes from
  `SANITY_TEXTS`. Measured, one pool was over its depth and it was not one of
  the three named.
- **§5.4** measured `arena.law` and missed `arena.laws`; the additive laws are
  2.3% and 2.5% of runs, not 0.56%.
- An earlier draft of the §7 event work weighted only the hazards, took the
  universal pool's boon share from 28.8% to 34.8%, and breached a guard:
  **victors with zero kills 24.7% → 32.2%**. The same trap the last pass fell
  into, in the other direction, caught the same way. Six of the eight new boons
  carry a cost now — which is also the register §7.4 asked for and the roster
  had nine of in 1,388.

Three more were caught by the roster mid-pass and never reached a commit: ten
sanity lines an edit had landed in `TRAINING_STATIONS.strength` (found by the
soak's unreplaced-placeholder assertion — "Silus works the {tribute} sings in
{zone}"), a duplicate `cartographer` achievement id, and two new entries with a
numeric threshold and no nearMiss.

### The one that got away

`victors with zero kills` went 29.9% → **24.7%** on the sanity work, meeting
its ≤25% design goal for the first time, and finished the pass at **28.5%** —
inside its ≤32% guard, better than it started, and short of goal again.

Something in the second half of the pass cost 3.8 points and it is not written
down here as a guess, because three 1,600-run measurements failed to find it:

- **Not the universal pool's generosity.** Measured by magnitude rather than by
  count, the fourteen new events made the pool slightly *harsher* — weighted
  help share 13.7% → 12.8%, weighted harm 1,116 → 1,204.
- **Not the endgame-gated events.** Neutralising the two that helped at ≤8
  alive moved it 28.5% → 28.5%.
- **Not the pair-role change**, which was the best hypothesis: `medic` carries
  `COMBAT.roleMedicShield` and pairs are 47.6% of alliance samples. Reverting
  it for one measurement moved it 28.5% → 28.3%.

What is left in that window is the 85 quirk rows, the medicine training sites
and the additive off-season laws — each individually tiny, and the honest
reading is that it is the sum of them rather than any one. Three falsified
hypotheses is a better place to leave this than a fourth guess dressed as a
cause, and the next pass has the three dead ends written down.

### Left open

- `victors with zero kills` at 28.5%, above.
- `runs with star-crossed lovers` sits at 15.9% against a 10–15% goal band,
  inside its 5–22% guard. Those are the two indicators of 25 short of goal.
- Eight achievements never unlock in 500 runs, all legendary, all carrying a
  nearMiss. `twelve-levers` is new and requires Gamemaker mode, which the sweep
  does not run.
- 44 hard-coded `traits.includes('X')` sites remain, now ratcheted. Converting
  them is design work per trait rather than a rename; `Star-Crossed` (twelve of
  the original 56) was the one unambiguous case and has a predicate.
- Every authored arena pack is still 33 events against a soft target of 40.

## Audit 3 fix pass (this branch)

Answers `AUDIT-3.md`. That report's theme was that the codebase's systems work
and happen and *cannot be counted* — five dead enum members, 1,123 events with
no identity, a balance guard that excluded the two archetypes failing it. The
theme of this pass turned out to be narrower and sharper than that: **live
state pruned before anything could read it.** The same bug, seven times, in
five subsystems, and once by the audit itself.

### The recurring bug (§1.6, §4.7, §6)

The achievement table is evaluated once, at the end of a run, against the final
state. That is the right design. Seven things were asking it about state that
does not survive to the end:

- `state.rumours` has a six-cycle lifetime and prunes exposed claims, so 'The
  Liar', 'Whisper Campaign' and 'Caught Out' were all reading for the thing
  that gets deleted.
- `state.alliances` at the end belongs to the one tribute standing, so 'Lawyers
  of the Arena' asked the wreckage for a three-clause charter.
- `state.blocTreaties` is emptied by *every* ending a treaty can have, so
  'The Treaty Year' could never be answered yes in 132 runs.
- `tickTriangles` deleted a love triangle the moment any of the three died, so
  the record was guaranteed empty by the epilogue — the system was firing in
  ~80% of runs and measuring as 1 in 132.

None needed a new mechanic. They needed somebody to write down that it
happened, the way `sharedGriefAllies` already did. `tickRunRecords` now keeps
the high-water marks; `blocTreatyHeld` and `endedBy` record the rest.

And 'Nobody Is Buying' derived "opening purse" from the largest *remaining*
purse and then required every purse, including that one, to be a quarter of it
— impossible unless every bloc sat at zero.

### Dead enum members (§1.2, §1.3)

- `Trap.kind` declares five and the sweep built two. Cordage was the sole gate
  on `snare` and `tripwire` and it is Cornucopia loot; a `stake` wanted a mutt
  venom gland *and* cordage. Ground that grows a line now gives you one, and a
  stake accepts any of the four things that can already coat a blade.
  **snare 4 → 114, tripwire 1 → 57, stake 0 → 7, traps 304 → 613.**
- `mintTrueRumours` could only produce two of four kinds, and the two it could
  not were the two `rumourPull` prices as *lures* — so every lure anybody heard
  was a lie, and the lure half of the taxonomy was a tell rather than a gamble.
  **true claims: restock 43, holed-up 295, cache 69, empty 72.**

Both now fail the build if any kind reads zero.

### Events that can be counted (§1.4)

1,123 of 1,323 authored arena events carried no `id`, because `id` was
documented as optional and almost every event took the option. `oncePerRun`
keys on it, `eventLastFired` keys on it, and nothing could count them —
answering "does this event ever reach a player" took a throwaway script
matching log text against templates by longest literal substring.

Ids are now derived at load from the arena id and a slug of the text: **1,449
of 1,449**, no source churn, impossible to forget on a new event. The soak
measures what could not previously be measured — **713/1,388 authored events
fired at least once**, with a regression floor, per-pack thinnest-reach
reporting, and a failure on any pack where nothing ever fired.

### Balance (§1.5, §8)

The metrics report read `archetype win-rate spread 1.63x  goal <= 2.3 MET` on a
line computed over seven of fifteen archetypes, and the two that actually
missed the goal were the two the guard is structurally unable to see. The three
statistics are now also printed over the whole field, unguarded, with the goal
attached and the run count needed to confirm a change named.

What that line then showed, and what closing it took:

- **Zealot** carried the highest risk tolerance in the game on the
  second-smallest attribute budget, and its `Desperate: 0.8` stance bias — the
  largest on any archetype — was pointed backwards at an archetype whose
  description is "does not break". Now carries willpower.
- **Saboteur** survived above the median and converted none of it, because
  `springTrap` incremented `trapKills` and never touched `kills`. A tribute who
  dies in a snare was killed by whoever tied it.
- **Bleeding out** — 6.1% of every death in the game — was recorded as a
  sourceless `status` wound, so a tribute who cut somebody open and walked away
  had killed nobody as far as the simulation was concerned. The same accounting
  gap, found by the guard it was breaking: `openWound` now records who opened
  it and the bleed-out death credits them.
  **victors with zero kills 32.5% → 29.4% at 400 runs, 29.9% at 1,600.**
- **Medic** had the Ghost's diagnosis (lasts, cannot close) and the Ghost's old
  answer. Now `late-blooming`, the curve that exists for exactly this.

Measured at 1,600 runs, every archetype at n ≥ 813:

  whole-field spread **3.33x → 1.92x** (goal ≤ 2.3x, MET)
  worst archetype **2.16% → 3.74%** (goal ≥ 3.5%, MET)
  victors with zero kills 29.9% → 27.0%

### The arena (§5)

- `blooming` is the only unambiguously good zone effect and the only thing that
  could start one was a rare authored event in eleven of forty arenas. Ground
  that has come all the way back now blooms.
- Eleven of fifteen laws were subtractions. Two that give: `bountifulGround`
  (the Story Wood, which takes medicine away, now has one place that heals) and
  `dawnMercy` (the Carnival — and pointed at the horn, the highest-danger tile,
  so the law makes ground worth contesting).
- Four more feast themes, including the two the format could not express:
  `tokens` and `empty`, where everything happens and nobody leaves holding
  anything.
- `check-arena-layout` sampled twelve procedural seeds against twelve biomes and
  a sixteen-zone ceiling. Widened to 120 — and it immediately found a real
  defect: two nodes 71.4 units apart against a 72-unit touch target, because
  the three layout passes ran once each in order and two of them move nodes
  after separation settles. Now run to a fixed point.

### Content (§7, §8.4, §10)

- **Grief 15 → 55 lines.** Fifteen against eighteen deaths a run means the
  player sees the whole pool inside one Games. Highest felt-staleness per line
  in the repository.
- **Betrayal witness 14 → 30, aftermath 16 → 32**, against 5.69 betrayals a run.
- **Mentors speak by legacy tier** — 80 new lines. The tier already drives a
  2.3x win-rate difference, so the game was already saying a forgotten-district
  mentor and a District 1 mentor are not alike, and only the prose disagreed.
- **Mentor pools 124 → 204**, twelve per district. They are the recurring cast.
- **Thirteen universal hazards**: drowning, falls, dying in your sleep — all of
  them things the model already tracked the state for and had no death for.
- **Social traits 6 → 14.** Six could not differentiate twenty-four tributes.

### The mistake worth recording

Adding thirteen hazards moved the universal pool from 18.8% boons to 14.8%.
That pool takes a fixed ~30% of every arena's draw, so it is a real rise in
ambient lethality, and the archetype whose edge is keeping people alive paid for
it: **medic 4.19% → 2.91%, spread 1.96x → 2.75x.** Isolated by stripping the
thirteen and re-measuring at 1,600 runs rather than by guessing. Corrected by
weighting them and adding four boons. "More ways to die" was the ask; raising
the death rate of the whole simulation was not.

### Interface (§1.7, §2)

- Four `role="dialog"` surfaces had no focus management; `CommandPalette`
  declared `aria-modal` and implemented none of it. `TributeModal` hand-rolled
  a copy of `useDialogFocus` that had already drifted from it.
- **141 `title=` attributes**, and for a lot of controls the `title` was the
  only statement of what the control does — the Gamemaker levers read
  "Ignite 40" with the effect in a tooltip. A native tooltip never appears on
  touch. `components/Hint.tsx` replaces them; **53 → 31 on controls**, with
  `npm run test:ui-affordances` as the ratchet.
- Four pieces of live state the engine wrote constantly and the interface never
  showed: `structuralFatigue`, `climateDrift`, `truceLedger`, and the weather
  front — the only hazard in the game with a position, which means it can be
  walked away from.
- The chronicle's "show earlier entries" paged 200 at a time instead of
  rendering the whole run.

### Achievements (§1.6, §11)

  never unlocked **17 → 6**, all legendary, all carrying a nearMiss (now
  enforced); rarity labels contradicted **12 → 0**; **157 → 170 entries**, with
  reaping 9 → 12 and oddity 10 → 14 against social's 48.

`npm run fix:rarity` writes the labels back rather than printing a blob to
paste by hand, which is why they had drifted three audits running. The sweep
runs at 500 rather than 200: it measures the ceiling every threshold is checked
against, and a legendary is by definition something a short sweep may not see.

### Nine findings withdrawn

Written up in `AUDIT-3.md` rather than quietly dropped, because an audit that
hides its own errors is worth less than one that does not.

- **§6.1/§9.2 (wildcards "five in rotation", and the top-ten recommendation
  built on it).** `firedWildcards` indexes *this run's calendar*, not the
  wildcard table. There are 40 kinds and every run draws 2–5. The report asked
  for a pool of twenty.
- **§6 (love triangles, 1 run in 132).** The system fires in ~80% of runs; the
  record was being deleted. The soak's own `triangles: formed=358` line said so
  and the probe did not read it — the same mistake this report documents five
  achievements making.
- **§6.2 (legendary items never observed).** The probe guessed
  `item.legendary`; the field is `item.legendName`.
- **§3.4 (eleven unguarded divisions).** Every one is guarded, mostly three
  lines above the division.
- **§2.4 (reduced motion).** Honoured globally by a `*` rule. `motion` was an
  unused dependency, now removed — the real and much smaller finding.
- **§2.7 (onClick on divs).** All four are `stopPropagation` guards on dialog
  panels.
- **§1.2 (the `stake` branch does not exist).** It did; the grep started one
  line below it. The measurement was right and the diagnosis was wrong.
- **§1.9 (38% of items carry no quality).** Weapons and armour only, by design.
- **§2.6 and §4.6** each had rows measured with the wrong instrument.

### Left open

Six achievements still never unlock in 500 runs. All six are legendary, all six
carry a nearMiss, and each is a genuine sub-0.2% outcome rather than an
unreachable one — `every-door` wants every once-per-run event in a single
Games, `the-unwitnessed` a victor who never shared a sector with anybody. They
are the tail the category is for.

Surnames (§10.3) are not done. They are the largest identity multiplier
available — 3,200 given names against 300 surnames is effectively unlimited,
and district families become expressible — but they touch display, uniqueness,
epithets and save migration, and that is a feature rather than a fix.

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
