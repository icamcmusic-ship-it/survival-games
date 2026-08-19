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
  output for a fixed seed. Also prints the training-score distribution.
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
