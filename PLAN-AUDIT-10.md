# AUDIT-10 implementation plan

The companion to `AUDIT-10.md`. That document is the audit; this one is what we
are doing about it, in what order, and what has to be true before each step is
allowed to count as done.

**Status:** batch 1 (the twenty-one confirmed defects, F01–F21), batch 1b (the
death-mix settings) and batch 2 (the shared physical rulebook) are implemented
and merged. Batches 3–6 below are planned, not built.

The audit's own framing governs the whole plan and is the thing most easily
lost once implementation starts:

> The game has considerable breadth: 45 authored arenas plus procedural
> generation, 36 archetypes, 153 rollable traits, 396 run achievements and 22
> meta achievements. **The highest-value work is to make these systems agree
> about what happened.**

Every batch below is a repair, a consistency pass, or a deepening of an
interaction that already exists. Nothing here is "add more nouns" — the
catalogue expansion in the audit's §6 and §12 is deliberately last, because
adding content to systems that disagree with each other produces more
disagreement.

The audit's recommended order is the plan's order:

1. Repair data-loss and malformed-input failures. *(batch 1 — done)*
2. Make rescue, movement, inventory and alliance interactions obey common
   physical rules. *(batch 1 partly; batch 2 completes it)*
3. Make histories, explanations and sharing report precisely what they know.
   *(batch 1 partly; batch 3 completes it)*
4. Tune balance with controlled comparisons and opportunity measurements.
   *(batch 4)*
5. Add complete event chains, arena transformations and cooperative choices,
   then expand catalogs. *(batches 5 and 6)*

**Naming constraint, restated because it governs every batch:** one given-name
field. No surnames, surname pools, surname toggles, surname generation, or
hidden surname metadata. Disambiguate with district badges and internal IDs.
Earned epithets stay separate from the name.

---

## Done — batch 1: the confirmed defects

F01–F21, the audit's §3. Each has a positioned scene in
`scripts/check-audit10-fixes.ts` that fails without the fix; the suite runs in
CI as `npm run test:audit10-fixes`.

The findings fell into three families, and it is worth naming them because the
same three will recur:

| Family | What it looked like | Repaired by |
|---|---|---|
| **A scene reports success with no corresponding physical result** | A clean rescue of a downed tribute left them at zero health, still downed, in the same place (F04). A hearing recorded somebody as fed on a ration that would not fit in their pack (F12). A copy control ticked in browsers with no clipboard (F16). | Typed results that the caller has to read: `relief` on a rescue record, an atomic transfer, a `CopyResult`. |
| **Remote people participate in a local interaction** | Three alliance members in three sectors shared one box (F10). A helper one level up revived somebody on the lower level (F09). A downed tribute climbed a shaft (F08). | One proximity predicate (`samePlace`), attendance at the cache's own location, `isActive` rather than `status === 'alive'`. |
| **A later sentence asserts something the state never recorded** | "Has not gone back" about somebody who had rejoined (F13). The top-ranked stance's reasons printed under the stance actually held (F18). "% of what it started with" over effective yield (F17). | Check before asserting, or word the claim so the incident alone supports it. |

Two things were repaired that the audit did not list, both surfaced by the
fixes:

- `finish()` in `downed.ts` inherited `kind: 'tribute'` with the source cleared
  on its no-killer path, so an arena-caused end to the rescue window produced a
  kill credited to a tribute the roster does not contain. Latent until F05 gave
  the arena a way into that path.
- Two balance knobs declared and never read (`test:knobs` caught them).

### What is deliberately *not* finished in batch 1

`F19` distinguishes four kinds of reproduction and implements three of them:
same seed, same initial conditions, and an honest refusal. **Recorded playback**
and **interactive branch** are not built. They need an intervention log in the
share payload and a policy for replaying against a newer engine, and half of
either is worse than neither. They are batch 3.

---

## Done — batch 1b: the death mix as a setting

Not an audit finding — a direct request — but it belongs in this plan because
it moved four of the audit's §8 indicators and had to be measured the way §8
asks for.

Two new `GameConfig` fields, both sliders on the setup screen, both travelling
in share links and save migrations:

- **`naturalDeathRate`** — how hard everything that is not another tribute
  hits. Default 0.3.
- **`bloodbathLethality`** — how many stay in the scrum at the Cornucopia and
  how hard the killing zone hits. Default 1.6.

The defaults were tuned by measurement, not chosen. Before: a 24-tribute field
lost about 11.5 to the arena and 11.5 to each other. After: a median of 16
tribute-dealt deaths and a median of 9 in the bloodbath.

Four things had to move with them, each for a reason worth keeping:

| Change | Why |
|---|---|
| The closing border and Gamemaker damage are exempt from `naturalDeathRate` (`UNSCALED_DAMAGE`) | The collapse is not arena attrition, it is the Gamemakers ending the Games. Scaling it down took five days out of the endgame's pressure and put them back into the run length. |
| `ESCALATION.startDay` 12→6, `convergeEarliestDay` 8→4, `convergeAtOrBelow` 6→10, `musterAtOrBelow` 12→16, `musterEarliestDay` 4→3, `collapseDamagePerDay` 10→15 | With the arena reined in, *meeting* is the only thing that ends a Games. These were set when attrition did half that work. |
| `ENCOUNTERS.meetChance` 0.4→0.62 | Same reason. Worth about a quarter of a tribute-dealt death per Games. |
| `BLOODBATH.careerReachBonus` 4→2.5, and the Career killing-zone bonus divided back out by the commitment factor | A Games decided by fighting is a Careers' Games: the change took Career victors from 52.7% to 58–60%, past the 55% guard. The audit's §8.5 says to price the behaviour causing the edge rather than applying a global combat nerf, and arrival order at the horn is that behaviour. |
| `RELATIONSHIPS.griefRepeatDecay` / `griefRepeatFloor` (new) | Grief was linear and unbounded, so time at the sanity floor was partly just a count of how many people died. The audit's §8.7 asks for exactly this bound. The fifth body is not the first body. |

Two new regression guards, per full-field Games rather than as shares, so they
are statements about the setting rather than about the sweep's district mix:
`bloodbath deaths per full-field Games` (6.5–11) and `tribute-dealt deaths per
full-field Games` (12–19).

---

## Done — batch 2: one physical rulebook

**The audit's §4 "shared legal-action contract", and the half of item 2 that
batch 1 left.** Batch 1 repaired nine individual violations of physical rules.
It did not give the engine a place to state those rules once, which is why
there were nine of them.

`src/engine/actions.ts` is that place, and `npm run test:actions` is nine
scenes proving it — including the one thing a reader cannot check by
inspection, which is that an action is validated *again* immediately before it
resolves.

### Done — B2-01: the action specification

An action carries: actor IDs, required capability, origin and target location
and level, resources reserved, duration, interruption policy, success criteria,
typed results. Validated **twice** — before committing and immediately before
resolution — because the audit's examples are all things that change in
between: the rescue target moved, the rope holder died, the cache emptied, a
gate closed, a promise expired mid-crossing.

The explicit queries: `canAct`, `canReach`, `canObserve`, `canTransfer`,
`canCarry`, `canAfford`. `isActive` means alive and not downed and *nothing
else* — it does not prove somebody is not in transit, or has free hands, or has
time. Rope reach is not medical contact. Hearing a scream is not identifying
its speaker.

Shipped: `canAct` (which is *not* `isActive` — it also refuses somebody
mid-crossing), `canReach` (contact), `canSpanTo` (a rope, which may be paid
down a level and never up), `canObserve`, `canSpend`, `canCarry`, `canTransfer`
and `canTravelTo`. Each returns a named refusal rather than a boolean, because
the audit's measurement list needs impossible attempts to be *countable* and a
branch nobody took cannot be counted.

`perform()` validates, validates again, then spends the hours, then resolves.
The rescue line, level changes, alliance hearings and downed treatment all go
through it; the longhand reach checks batch 1 wrote in each of them are gone.

*Still to do:* a guard that fails the build when a new subsystem invents its
own check, the way `test:knobs` catches a dead knob. The contract exists; using
it is still a convention.

### B2-02 — stable equipment identity

Track a specific blade, rope, medicine batch or token through transfers.
Ownership, durability and provenance survive save and resume. This is the
prerequisite for the audit's §10 heirloom, crafting and food-batch items, and
for F13's "did they still have the rope" question being answerable rather than
inferable.

### Done — B2-03: behaviour metrics (the first half)

`state.actionLedger` counts attempts and refusals per action kind and reason;
`test:metrics` prints the ledger. The audit is explicit about why: *"these
reveal failures that 'event fired at least once' cannot."*

It earned its place immediately. The first run found `change-level` at 0% —
the hours charge F15 added had made the whole verticality feature unreachable,
and every existing check passed, because "a chain that never fires" and "a
chain that is meant to be rare" look identical to all of them. Measured at 200
runs after the repair:

| Action | Per run | Reading |
|---|---|---|
| `rescue-line` | 2.7 done, 0 refused | F07's filter-first selection works: nobody is chosen who cannot act |
| `change-level` | 13.3 done, 68% through | healthy; refusals are hours and crossings, both correct |
| `treat-downed` | 1.5 done, 13% through | 6.9 refusals a run are `out-of-contact` — F09's level separation, working as intended and worth watching |
| `alliance-hearing` | 0.2 done, 32% through | **a chain that barely fires.** Not tuned here; named for batch 5 |

*Still to do:* affordable-plan completion, fallback usefulness, repeated no-op
cycles, wasted journeys, and the rescue opportunity/attempt/success funnel.
Those need the plan layer in B2-04, which does not exist yet.

### B2-04 — decisions without omniscience

Plans with a fallback; confidence-aware beliefs (stale information becomes
uncertain, not false); commitment with explicit costs; opportunity cost;
recovery planning; selective risk; adaptive opponents that learn only from what
they witnessed. Keep attributes, traits, learned proficiencies and temporary
conditions distinct rather than expressing one advantage in all four layers.

---

## Batch 3 — say only what you know

**The audit's §3 reporting family, completed, plus §9's P1 and P2 rows.**

### B3-01 — the replay manifest, finished — **done**

Recorded playback and interactive branch. Version the manifest (batch 1 started
this at `mv=1`); carry cast overrides and intervention records; archived runs
with insufficient inputs say "relaunch under current rules", which batch 1's
Hall-of-Fame notice already does. Persist replay expectations across updates
without requiring old engines to be kept alive forever.

### B3-02 — the panels the state deserves — **done**

Budget and project panel (hours remaining, current project site, progress,
reserved materials, why it paused — these state fields have no dedicated
component today). Forecasts on the map and dossier, distinguishing pending
warnings from active effects. Upper/lower occupancy and reachable connections,
so a player can see why visible people cannot trade or treat each other.
Causal event inspection: from a death, jump to the wound, the source incident,
the failed escape, the attribution. An alliance ledger.

### B3-03 — typed achievement triggers — **done** (partial: ten entries still read the chronicle, listed by `test:milestones`)

Some achievements parse prose with regular expressions. Migrate factual
triggers to typed events and counters, beginning with anything affected by log
trimming. More flavour text must not change whether an achievement is earned.

### B3-04 — accessibility and feed — **done**

Three of the four were already in place from earlier batches and are held by
`test:ui`: the live region announces a summary rather than every line, the
colourblind and high-contrast palettes exist and apply, and reduced motion is
honoured. The fourth — cast validation against Unicode and visually confusing
duplicates — turned out to describe a problem this codebase does not have.
Measured across 2,000 casts over four configurations, no two tributes in one
cast share a name a reader would fold together, so `test:names` guards that
rather than building district-badge disambiguation for a collision that never
arises. Building it would have meant code nobody can test and nobody would
notice rotting.


Announce a compact batch summary rather than hundreds of log lines. Colour is
never the only signal. Honour reduced motion. Cast validation with Unicode and
visually confusing duplicates, resolved with district badges — not surnames.

---

## Batch 4 — balance you can defend

**The audit's §8.** The audit is emphatic that the current rankings are not
causal estimates: district, arena, preferred traits, age, body, starting items
and available opponents confound them, and the top and bottom are selected
extremes.

### B4-01 — matched cohorts — **done**

Compare otherwise-matched casts across archetype and trait changes using fixed
scenario inputs and deterministic random streams. **A shared seed alone is not
a clean counterfactual** if an earlier branch consumes different draws. This is
the instrument the rest of the batch needs and it does not exist yet.

### B4-02 — the opportunity funnel — **done for the two named cases**

Per signature: alive long enough → prerequisite available → aware of the
opportunity → legal action affordable → attempted → succeeded → lasting
benefit. This is what stops an opportunity failure being hidden behind a larger
bonus, which is the failure mode behind every one of the low-signature
archetypes.

### B4-03 — the named cases — **Tracker done; the premise revisited**

Tracker (3.51%, lowest): measure target discovery, route feasibility, safe
intercepts, and outcomes after a tracked contact. Reward useful information and
avoided danger, not only pursuit. Broker (3.78%, signature at 30.0% against a
29% floor): measure same-place customers with complementary surplus; an
inaccessible customer is not fixed by a better sale multiplier. Opportunist and
Career: inspect finishing credit, free repeated actions, starting kit and
target selection — batch 1b already priced one of these (`careerReachBonus`)
and the same method applies to the rest.

### B4-04 — honest sampling everywhere — **done**

F20 fixed the trait table's verdict. The same rule — a release gate needs
adequate samples *for the compared rows*, with intervals, and exploratory
rankings labelled as such — needs applying to every other whole-table verdict
in `metrics.ts`. Deliberately oversample rare traits across applicable arenas.
Report acquisition at reaping separately from earned traits: high survival
among holders of "Outlived The Pack" is not evidence the trait is strong.

---

## Batch 5 — chains that remember

**The audit's §5, §6 and §7.** Only after batches 2–4, because each of these is
a physical interaction, and the point of batch 2 is that there is one rulebook
for those.

### B5-01 — relationships with distinct jobs — **contextual trust done; the rest open**

Contextual trust (repayment, combat support, information — a liar can be a
reliable shield); shared decisions with a recorded proposal, voters, positions
and concession; leadership succession that changes routes and priorities rather
than a label; bounded obligations with destination, amount, quality, deadline
and exceptions; witnessed events, so private, suspected and proven betrayal are
three different things and knowledge travels physically; negotiated conflict
where breakup is one outcome and not the only one; fair scarcity with ration
ledgers and protected reserves (batch 1 started this at F11); real reunions;
coalitions with a target and an expiry; earned endgame relationships seeded
through routes and contested resources rather than assigned at the finale.

### B5-02 — arena systems — **projects and forecast lead time done; topology and recovery open**

Done: sited work belongs to the site (`GameState.projects`) and can be
discovered, continued, inherited and damaged; forecast lead time measured and
guarded (no forecast may be due on the cycle it is announced); hazard warning
coverage measured at 62%, reported rather than guarded because raising it means
forecasting hazards that do not forecast today, which is a death-mix change.

Open: topology that matters (directed and conditionally passable edges,
capacity, traversal time, noise, load), recovery and opportunity so late games
are not all accumulation of punishment, procedural compatibility from
capability tags.

Topology that matters (directed and conditionally passable edges, capacity,
traversal time, level, noise, load). Persistent projects that belong to the
site and can be discovered, finished, damaged or appropriated by somebody else.
Forecasts with actionable lead time — *a log line immediately followed by
resolution in the same function is not an intervention window*. Physical hazard
propagation with capped chains and no accidental extra tick from iteration
order. Recovery and opportunity, so late games are not all the same
accumulation of punishment. Procedural compatibility from capability tags.

### B5-03 — the chains — **five nonlethal events built; the lethal table open**

Built, each with the four parts §7 asks of every row — a warning, a choice, a
nonfatal result and a durable record:

| event | what it needed |
|---|---|
| an abandoned project | the project ledger; it then ate the ledger's own feature until the guard caught it |
| exchanged warnings | forecasts could not be passed on at all; now weighted by credibility |
| a false alarm | a forecast that always lands is a countdown, not a warning |
| shared cooking | would have been dead content gated on a fire — one qualifying case in 40 runs |
| a repair apprenticeship | `trainProficiency` was solitary: you got better by doing, never by being shown |

Already present and not rebuilt: borrowed equipment (`Tribute.loans`), an honest
refusal (batch 2's named `Refusal` contract), restitution and a public promise
(debts, charters, pacts).

Open: a disputed map, disputed credit, an escort that succeeds; and the whole
§6/§7 lethal table. The instruction that governs it stands — **do not simply
add lethality to the existing scheduler**, and every opportunity is checked for
whether it can arise before the beat is written.

The audit's §6 table (one per arena) and §7 table (twelve universal chains).
Each row needs a warning, an avoidance or mitigation, a nonfatal result and a
durable cause record. Build the nonlethal ones at least as deliberately as the
lethal ones: a disputed map, borrowed equipment, a repair apprenticeship,
shared cooking, exchanged warnings, an honest refusal, disputed credit,
restitution, an abandoned project, a false alarm, an escort that succeeds, a
public promise quietly kept.

**Do not simply add lethality to the existing scheduler.** Replace repetitive
low-information hazard rolls with these chains and monitor run length,
recoverable injury, opportunity for response and the death-cause distribution.
A death should be surprising in outcome, not inexplicable in prerequisites. The
two death-mix sliders from batch 1b are the instrument for holding that line
while the chains land.

---

## Batch 6 — replayability, then catalogue

**The audit's §10, §11 and §12, in that order.**

Scenario manifests with recorded initial conditions and versions. Different
strategic pressures rather than more arena names with the same movement and
resource pattern. Story-aware scheduling that tracks repeated situation *types*
rather than repeated strings. Opportunity coverage: a subsystem that appears in
one run in a thousand is not everyday depth. Character arcs evidenced by
actions rather than labelled retrospectively. Alternative finales with explicit
victory conditions. Discovery without power inflation. Counterfactual debrief
built on the existing rewind foundations.

Then, and only then, the catalogue: the 24 proposed achievement specifications,
screened for semantic overlap with the current 396, with rarity following
measured eligible opportunities and each needing a positive fixture, a near-miss
fixture, save/resume coverage and typed evidence.

**Preserve quiet stretches and nonfatal consequences.** Making every phase a
disaster exhausts the player and makes significant events interchangeable.

---

## Standing rules for every batch

1. **A finding is not repaired until a scene fails without the repair.**
   `scripts/check-audit10-fixes.ts` is the pattern; a sweep asserts aggregates
   and a static check never starts the simulator, so neither can state a
   proposition about one tribute's cycle.
2. **A number in prose is a copy of a table that nothing updates.** F21's three
   stale counts were all true once. `npm run catalog` generates them; anything
   it can produce must not be restated by hand.
3. **A verdict needs a sample for the thing it is judging.** F20's rule
   generalises: eligibility is about the compared rows, intervals are reported,
   and an exploratory ranking says so.
4. **Balance changes are measured, not argued.** Batch 1b moved six knobs and
   every one of them has its measurement in the comment beside it.
5. **Reporting is bounded by what was recorded.** If the prose wants to claim
   something about the interval since an incident, record the interval; if not,
   word the claim so the incident alone supports it.
