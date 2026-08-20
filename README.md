# Survival Games

A highly replayable, robust text-based survival/tribute simulator with dynamic arenas, attributes, and a gamemaker mode.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

## Build

`npm run build` outputs a static site to `dist/`, deployed to GitHub Pages via `.github/workflows/deploy.yml` on push to `main`.

## Tests

- `npm run lint` — TypeScript type check.
- `npm run test:sim` — headless soak test: hundreds of complete runs across every
  arena and config spread, asserting no infinite loops, vitals within range,
  unique names and log ids, no unreplaced text placeholders, and deterministic
  output for a fixed seed. It also asserts the behavioural invariants — zones
  recover instead of depleting permanently, no tribute thrashes stance cycle to
  cycle, relationships stay inside their bounds under grief and betrayal, every
  obituary names the source that actually landed the killing blow, and no
  mechanic (vengeance, group combat, retreat, grief) silently never fires.
  Prints the training-score distribution and a behaviour summary.
- `npm run test:arenas` — structural check on the hand-authored arenas: zone
  graphs connected and symmetric, every arena backed by its own flavour pack.
  It also scans the source for seeded shuffles written as
  `sort(() => rng() - 0.5)`, which is deterministic within one JS engine but
  consumes a different number of RNG draws in another — so a same-process
  replay test can never catch it, and the Share URL silently stops replaying
  the same Games in a different browser.
- `npm run test:ui` — Chromium smoke test covering every screen, control and
  keyboard shortcut; fails on any console or page error. Needs `npm run dev`
  running on port 3000.

## How a run works

`setup → reaping → training → interviews → bloodbath → day/night cycles
(with feasts) → epilogue → debrief`

The whole simulation is seeded: the same seed plus arena always replays the
same Games, which is what the Share button encodes into a URL.

Every logged event carries a semantic category (kill, hazard, alliance,
sponsor, sanity, …) that drives the colour coding and the filters in the
chronicle feed.

## How the simulation is put together

The engine is deliberately wired so subsystems feed each other rather than
running in parallel:

- **Combat** (`engine/combat.ts`) resolves as multi-round exchanges with a
  retreat check every round, and handles three-or-more-tribute zones as real
  group fights with a numbers advantage and focus fire. Every point of damage
  records its source, so cause of death is the thing that actually killed you.
- **Stealth** (`engine/stealth.ts`) is concealment versus awareness: a hidden
  tribute is not found at all this cycle, and a tribute who opens a fight from
  cover gets a free hit. The Gamemakers strip cover away once the field is down
  to the last few, so nobody can hide their way to a stalemate.
- **Exposure** (`engine/exposure.ts`, `engine/climate.ts`) is one system. An
  arena's standing weather and a Gamemaker-triggered storm are the same kind of
  object — a profile describing what the weather does to a body — so they
  cannot drift apart or stack two different freeze implementations on the same
  tribute.
- **Memory** (`engine/memory.ts`) is what each tribute personally knows: which
  zones cost lives, who was standing where, how picked-over the ground is, who
  they owe a debt to. Movement, stance and targeting all read from it.
- **Relationships** (`engine/relationships.ts`) own every write to the social
  graph. Tributes start with backstory ties (district partners, academy
  classmates, age gaps), bonds decay without contact, deaths propagate grief and
  vengeance to everyone who cared, and betrayal dents the numbers whether or not
  the fight that follows resolves.
- **Zone economy** (`engine/map.ts`) makes forage a finite stock that depletes
  and regrows, so a resource-rich zone is a prize other tributes can strip.
- **Balance** (`data/balance.ts`) holds every tunable number the engine reads —
  vitals drains, damage, thresholds, decay rates, gate probabilities — so
  balancing a run means editing one file.
- **Districts** (`data/districts.ts`) carry a Games record. A tribute from a
  storied district arrives with a mentor who has stood on the podium and a
  crowd that already expects them to do well; a tribute from a forgotten one
  does not.

The day/night phase (`phases/dayNight.ts`) is the orchestrator and nothing
else — the order things happen in. Terrain, vitals and medicine live in
`engine/survival.ts`, destination scoring in `engine/movement.ts`, threat
assessment and stance hysteresis in `engine/stance.ts`, and hazards, meetings
and sanity breaks in `engine/encounters.ts`.
