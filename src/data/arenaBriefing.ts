import { Arena, ArenaLawId, Terrain } from '../models/types';

/**
 * §2.1: what a player is allowed to know before they commit.
 *
 * The setup screen let you pick an arena by name and a one-line signature
 * blurb, and then showed you nothing else until the bloodbath — no zone graph,
 * no law, no climate, no mutt kit. That is a choice made blind, and the
 * information is not secret: it is printed on the arena the moment the run
 * starts.
 *
 * Lives in `data/` on purpose. The setup screen is the app's cold-start path
 * and must not drag `engine/` (and its several thousand lines of balance and
 * flavour tables) in with it, which is why this file describes arenas rather
 * than importing anything that simulates them.
 */

export const LAW_LABELS: Record<ArenaLawId, { name: string; detail: string }> = {
    noCannons: {
        name: 'No cannons',
        detail: 'No cannon, no faces in the sky. You only know somebody is dead if you saw it.',
    },
    cornucopiaRefills: {
        name: 'The horn refills',
        detail: 'The Cornucopia restocks on a schedule all run, not once on the first morning.',
    },
    sponsorsFixedZone: {
        name: 'Fixed drop zone',
        detail: 'Every gift lands in one named sector. Nothing reaches you anywhere else.',
    },
    noNight: {
        name: 'No night',
        detail: 'The sun never sets. There is no rest phase, and fatigue never fully clears.',
    },
    noWaterExceptZone: {
        name: 'One water source',
        detail: 'Exactly one sector yields water. Everywhere else is as dry as open ground.',
    },
    fireImpossible: {
        name: 'No fire',
        detail: 'Nothing burns in here. Cold nights are survived on what you are wearing.',
    },
    noSponsors: {
        name: 'Communications blackout',
        detail: 'No parachute ever lands. Whatever you find is what you have.',
    },
    noHealing: {
        name: 'No medicine',
        detail: 'Medical supplies do nothing. Rest is the only recovery there is.',
    },
};

/**
 * Arena id -> the climate a player would be told about. Kept in step with
 * `CLIMATES` in `engine/climate.ts` by `npm run test:arenas`, which fails if an
 * arena has a climate profile and no label for it.
 */
export const CLIMATE_LABELS: Record<string, string> = {
    frozen: 'Freezing. Nights take health directly, and a fire is the difference.',
    glacier: 'Freezing. Nights take health directly, and a fire is the difference.',
    alpine: 'Freezing. Nights take health directly, and a fire is the difference.',
    seapeaks: 'Freezing. Nights take health directly, and a fire is the difference.',
    'procedural-highlands': 'Freezing. Nights take health directly, and a fire is the difference.',
    'procedural-tundra': 'Freezing. Nights take health directly, and a fire is the difference.',
    floe: 'Sea cold, and wet with it. The wind finds anyone who has been in the water.',
    reef: 'A sea floor with the sea subtracted: no shade, no water, and glare all day.',
    islands: 'Fog that moves against the wind. Nothing you see at distance is reliable.',
    carnival: 'Fog off the pines. Nothing you see at distance is reliable.',
    acousticforest: 'Fog and echo. Nothing you hear at distance is reliable either.',
    'procedural-ruinlands': 'Fog through the ruins. Nothing you see at distance is reliable.',
    eclipse: 'Perpetual dusk. It has been the last minute before dark for eleven days.',
    abattoir: 'Furnace heat, indoors, all day and all night.',
    ashwaste: 'Ash in the air. It gets into water, wounds and lungs alike.',
    ashfall: 'Ash in the air. It gets into water, wounds and lungs alike.',
    burnscar: 'Ash in the air. It gets into water, wounds and lungs alike.',
    'procedural-volcanic': 'Ash in the air. It gets into water, wounds and lungs alike.',
    quarry: 'Damp and cold in the pit, and it never quite dries out.',
    solar: 'Desert heat. Water is the whole game and there is not much of it.',
    saltflats: 'Desert heat. Water is the whole game and there is not much of it.',
    'procedural-dunes': 'Desert heat. Water is the whole game and there is not much of it.',
    toxic: 'Wet, warm and foul. Open water here is not safe to drink.',
    sporefields: 'Wet, warm and foul. Open water here is not safe to drink.',
    craterfield: 'Wet, warm and foul. Open water here is not safe to drink.',
    'procedural-rainforest': 'Wet, warm and foul. Open water here is not safe to drink.',
    'procedural-bayou': 'Wet, warm and foul. Open water here is not safe to drink.',
    tempest: 'Storm-bound. The weather is the arena, and it does not stall for long.',
    'procedural-archipelago': 'Storm-bound. The weather is the arena, and it does not stall for long.',
};

const TERRAIN_LABELS: Record<Terrain, string> = {
    open: 'open ground',
    forest: 'forest',
    water: 'water',
    highland: 'high ground',
    ruins: 'ruins',
    wetland: 'wetland',
};

/** Every standing law on this arena, `law` and `laws` folded into one list. */
export function lawsOf(arena: Arena): ArenaLawId[] {
    return [...new Set([...(arena.law ? [arena.law] : []), ...(arena.laws ?? [])])];
}

/** "4 forest · 3 open ground · 2 water", commonest first. */
export function terrainMix(arena: Arena): string {
    const counts = new Map<Terrain, number>();
    arena.zones.forEach(z => counts.set(z.terrain, (counts.get(z.terrain) ?? 0) + 1));
    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([terrain, n]) => `${n} ${TERRAIN_LABELS[terrain]}`)
        .join(' · ');
}

/**
 * §2.1: a rough run-length estimate from the settings, in plain English.
 *
 * The simulation knows its own distribution — a 400-run soak puts the mean at
 * about seven days with a two-day spread — and the two settings that actually
 * move it are how big the field is and how hard the arena is pushing. This is
 * deliberately a range rather than a number: it is a forecast, not a promise.
 */
export function lengthEstimate(districtCount: number, hazardRate: number, betrayalRate: number): string {
    // Bigger fields take longer to resolve; hazards and betrayals both shorten
    // a run by killing people faster than attrition does.
    const base = 4.2 + districtCount * 0.26;
    const pressure = 1 / (0.72 + hazardRate * 0.18 + betrayalRate * 0.1);
    const mid = base * pressure;
    const low = Math.max(2, Math.round(mid - 2.2));
    const high = Math.round(mid + 2.6);
    return `typically ${low}–${high} days`;
}
