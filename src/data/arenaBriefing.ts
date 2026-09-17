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

/**
 * §2 (requests): what a law actually does, not just what it is called.
 *
 * A law used to be a name and one sentence of tone. That is enough to pick an
 * arena by vibe and not enough to pick one on purpose, because the sentence
 * never said which number moved. Every entry now carries:
 *
 *   kind      whether the law takes something away, gives something, or
 *             redirects it. Drives the colour of the chip in the picker.
 *   severity  how much it changes a run, 1-3. A player scanning a roster wants
 *             to know whether they are choosing a texture or a different game.
 *   affects   the systems it touches, for the facet filters.
 *   effects   the concrete mechanical consequences, one line each, in the
 *             player's terms. This is the part that was missing.
 *   extraEvents  §3: laws that put more arena set pieces into a run, and how
 *             many. A law that adds pressure should add incidents.
 */
export type LawKind = 'takes' | 'gives' | 'redirects';
export type LawSystem = 'water' | 'food' | 'fire' | 'medicine' | 'sponsors' | 'movement'
    | 'combat' | 'information' | 'time' | 'weather';

export interface LawLabel {
    name: string;
    detail: string;
    kind: LawKind;
    /** 1 = a texture, 2 = a real constraint, 3 = a different game. */
    severity: 1 | 2 | 3;
    affects: LawSystem[];
    /** One line per mechanical consequence, phrased as what the player will see. */
    effects: string[];
    /** §3: extra arena set pieces this law adds to the run's plan. */
    extraEvents?: number;
}

export const LAW_LABELS: Record<ArenaLawId, LawLabel> = {
    noCannons: {
        name: 'No cannons',
        detail: 'No cannon, no faces in the sky. You only know somebody is dead if you saw it.',
        kind: 'takes',
        severity: 2,
        affects: ['information'],
        effects: [
            'No death is announced. The standings only update for tributes whose deaths were witnessed.',
            'Alliances keep hunting people who are already dead, and keep fearing them.',
            'Nobody grieves an ally they did not see fall, so the grief bonds that normally form never do.',
        ],
    },
    cornucopiaRefills: {
        name: 'The horn refills',
        detail: 'The Cornucopia restocks on a schedule all run, not once on the first morning.',
        kind: 'gives',
        severity: 2,
        affects: ['food', 'combat'],
        effects: [
            'Supplies drop at the Cornucopia every escalation cycle instead of once on day one.',
            'The centre of the map stays worth holding, so the horn is contested all run rather than abandoned by day three.',
            'Whoever holds the horn is fed — and is therefore where everyone else has to go.',
        ],
        extraEvents: 1,
    },
    sponsorsFixedZone: {
        name: 'Fixed drop zone',
        detail: 'Every gift lands in one named sector. Nothing reaches you anywhere else.',
        kind: 'redirects',
        severity: 2,
        affects: ['sponsors', 'movement'],
        effects: [
            'A parachute only delivers to a tribute standing in the arena\'s law zone. Everywhere else, the gift is simply not sent.',
            'Wounded tributes have to walk to their medicine, across open ground, in front of everybody.',
            'The drop zone becomes a second Cornucopia and is ambushed like one.',
        ],
    },
    noNight: {
        name: 'No night',
        detail: 'The sun never sets. There is no rest phase, and fatigue never fully clears.',
        kind: 'takes',
        severity: 3,
        affects: ['time'],
        effects: [
            'Every cycle is a day cycle. The night phase never runs.',
            'Sleep never fully clears fatigue, so sleep debt accumulates from day two onward.',
            'Nothing is hidden by darkness: stealth loses the night bonus, and nobody gets an unseen approach out of it.',
        ],
    },
    noWaterExceptZone: {
        name: 'One water source',
        detail: 'Exactly one sector yields water. Everywhere else is as dry as open ground.',
        kind: 'takes',
        severity: 3,
        affects: ['water', 'movement'],
        effects: [
            'Only the arena\'s law zone relieves thirst. Rivers, lakes and rain elsewhere do nothing.',
            'Every living tribute has to return to the same sector every day or two.',
            'Holding the water is the whole strategy, and it is the most ambushed ground in the arena.',
        ],
        extraEvents: 1,
    },
    fireImpossible: {
        name: 'No fire',
        detail: 'Nothing burns in here. Cold nights are survived on what you are wearing.',
        kind: 'takes',
        severity: 2,
        affects: ['fire', 'food'],
        effects: [
            'No fire can be lit anywhere, by anyone, ever.',
            'Cold nights take health directly with nothing to offset them but clothing and condition.',
            'Nothing can be cooked, so raw food carries its full sickness risk and water cannot be boiled.',
        ],
    },
    noSponsors: {
        name: 'Communications blackout',
        detail: 'No parachute ever lands. Whatever you find is what you have.',
        kind: 'takes',
        severity: 3,
        affects: ['sponsors', 'medicine'],
        effects: [
            'No gift is ever delivered, however popular the tribute or however rich the patron.',
            'Mentors cannot intervene. A dying tribute is not rescued from above.',
            'Everything anybody uses came out of the horn or off a body.',
        ],
    },
    noHealing: {
        name: 'No medicine',
        detail: 'Medical supplies do nothing. Rest is the only recovery there is.',
        kind: 'takes',
        severity: 3,
        affects: ['medicine'],
        effects: [
            'Bandages, salve, antidote and painkillers have no effect when used.',
            'Bleeding, infection and poison run their full course; only rest and time reduce them.',
            'A serious wound on day two is usually what kills the tribute on day five.',
        ],
    },
    noForage: {
        name: 'Nothing grows',
        detail: 'Nothing edible grows in this arena. Everything anybody eats came out of the horn.',
        kind: 'takes',
        severity: 3,
        affects: ['food'],
        effects: [
            'Foraging outside the Cornucopia always fails, whatever the tribute\'s skill or the zone\'s resources.',
            'Hunger is on a clock from the gong, and the only stopwatch is how much anyone grabbed.',
            'A tribute who fled the bloodbath empty-handed is on a countdown rather than a strategy.',
        ],
        extraEvents: 1,
    },
    deadlyNight: {
        name: 'The dark is the hazard',
        detail: 'Whatever this arena does to people, it does twice as often after dark.',
        kind: 'takes',
        severity: 2,
        affects: ['time', 'weather'],
        effects: [
            'Zone hazards fire at double severity during every night phase.',
            'Travelling after dark is a genuinely worse idea here than anywhere else.',
            'Shelter quality matters more than in any other arena, because the night is the thing being survived.',
        ],
        extraEvents: 1,
    },
    oneWayBorders: {
        name: 'One-way ground',
        detail: 'The ground runs one way. Where you can go from here is not where you can come back from.',
        kind: 'redirects',
        severity: 3,
        affects: ['movement'],
        effects: [
            'Every edge on the map runs in one direction only, fixed for the run.',
            'A tribute cannot retreat the way they came, so every move is a commitment.',
            'The map drains toward the Cornucopia over time, which the Gamemakers count on.',
        ],
    },
    noWeapons: {
        name: 'No weapons',
        detail: 'There is not a weapon in this arena. Whatever happens, happens with hands and terrain.',
        kind: 'takes',
        severity: 3,
        affects: ['combat'],
        effects: [
            'No weapon exists in any loot pool, including the Cornucopia and the feast.',
            'Every fight is unarmed: strength, frame and grapple resistance decide it, and Careers lose most of their edge.',
            'Fights last longer and kill less often, so the arena itself takes a larger share of the deaths.',
        ],
    },
    shrinkingArena: {
        name: 'Closing from the first morning',
        detail: 'The border does not wait for the Gamemakers to get bored. It starts closing on day one.',
        kind: 'takes',
        severity: 3,
        affects: ['movement', 'time'],
        effects: [
            'Border collapse begins on day one rather than waiting for day six or a bored Gamemaker.',
            'Zones go out of bounds on a schedule from the start, and anyone caught in one takes escalating damage.',
            'Runs here are short. The field is pushed together days earlier than in any other arena.',
        ],
        extraEvents: 1,
    },
    openMic: {
        name: 'Open mic',
        detail: 'Every fight in this arena is audible from every other sector. Nothing here is private.',
        kind: 'redirects',
        severity: 2,
        affects: ['information', 'combat'],
        effects: [
            'Every fight is heard arena-wide: all living tributes learn where it happened and who was in it.',
            'Nobody can pick off a straggler quietly — a kill draws whoever wanted that kill.',
            'Hiding works; fighting does not. Stealth is worth more here than anywhere else.',
        ],
        extraEvents: 1,
    },
    // Audit 3 §5.2: the two that give.
    bountifulGround: {
        name: 'The good ground',
        detail: 'One sector of this arena is always in flower. It feeds, it heals, and everybody knows where it is.',
        kind: 'gives',
        severity: 2,
        affects: ['food', 'medicine', 'water'],
        effects: [
            'The arena\'s law zone never depletes: it feeds, waters, heals and settles anyone who rests there.',
            'It is the one place in the arena worth defending, and it is defended.',
            'A tribute who holds it does not starve — which means the Gamemakers come for them instead.',
        ],
    },
    dawnMercy: {
        name: 'Mercy at dawn',
        detail: 'Anybody who spends the night at the Cornucopia is treated at first light. The Capitol calls it generosity.',
        kind: 'gives',
        severity: 1,
        affects: ['medicine'],
        effects: [
            'Every tribute who is at the Cornucopia at the start of a day phase is healed and has bleeding stopped.',
            'The horn stays occupied all run, so the centre of the map never goes quiet.',
            'Wounded tributes gamble on walking into the most dangerous sector in the arena to be treated.',
        ],
    },
    /*
     * §1-2 (requests): the five new laws, one per new arena.
     */
    tidalBorders: {
        name: 'The tide re-cuts the map',
        detail: 'The routes between sectors are not the same two nights running. The tide closes some and opens others.',
        kind: 'redirects',
        severity: 3,
        affects: ['movement', 'time'],
        effects: [
            'Every night, a third of the map\'s routes are severed and the previously severed ones re-open.',
            'A route scouted in daylight may not exist after dark, and a dead end may not stay one.',
            'Alliances are split by the map itself, regularly, with nobody choosing it.',
        ],
        extraEvents: 1,
    },
    bloodPrice: {
        name: 'The horn is bought',
        detail: 'The Cornucopia does not open for anyone who has not killed. The Capitol is explicit about the terms.',
        kind: 'redirects',
        severity: 3,
        affects: ['food', 'combat'],
        effects: [
            'A tribute with no kills gets nothing from the Cornucopia: no loot, no restock, no feast claim.',
            'Killing once unlocks the horn permanently for that tribute.',
            'Pacifist runs are not survivable here, and the field knows it from the briefing onward.',
        ],
        extraEvents: 1,
    },
    noRest: {
        name: 'No rest',
        detail: 'Sleep does nothing in this arena. Fatigue comes off only by standing still in daylight, and slowly.',
        kind: 'takes',
        severity: 3,
        affects: ['time'],
        effects: [
            'Sleeping recovers no fatigue and clears no sleep debt.',
            'The only recovery is resting in place during a day phase, at roughly half the usual rate.',
            'Everybody is exhausted by day four, and exhausted tributes drop kit, misjudge fights and hold stances too long.',
        ],
    },
    meltingGround: {
        name: 'The ground does not recover',
        detail: 'Whatever a sector had, it has less of once somebody has been through it. Nothing here grows back.',
        kind: 'takes',
        severity: 3,
        affects: ['food', 'water', 'movement'],
        effects: [
            'Every zone a tribute spends a cycle in is permanently depleted behind them.',
            'Water and forage in a well-travelled sector run out for good, for everybody.',
            'The map becomes uninhabitable from the middle outward, which drives the field together without the border moving.',
        ],
        extraEvents: 1,
    },
    twinSuns: {
        name: 'Two suns, no shade',
        detail: 'There is nowhere in this arena out of the light. Cover hides you from people, not from the sky.',
        kind: 'takes',
        severity: 3,
        affects: ['water', 'weather'],
        effects: [
            'Heat load applies in every zone regardless of terrain, cover or shelter.',
            'Thirst runs at roughly half again the usual rate, everywhere, all day.',
            'Water is the whole game, and standing still in cover does not save anybody from the sun.',
        ],
        extraEvents: 1,
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
    'procedural-steppe': 'Open and dry, with a wind that never drops. Shade is wherever you make it.',
    'procedural-badlands': 'Canyon heat, and the water is at the bottom of everything.',
    'procedural-saltmarsh': 'Storm-driven and tidal. The map is a different map twice a day.',
    'procedural-boreal': 'Damp and cold under the trees, and it never quite dries out.',
    eclipse: 'Perpetual dusk. It has been the last minute before dark for eleven days.',
    abattoir: 'Furnace heat, indoors, all day and all night.',
    ashwaste: 'Ash in the air. It gets into water, wounds and lungs alike.',
    ashfall: 'Ash in the air. It gets into water, wounds and lungs alike.',
    burnscar: 'Ash in the air. It gets into water, wounds and lungs alike.',
    'procedural-volcanic': 'Ash in the air. It gets into water, wounds and lungs alike.',
    quarry: 'Damp and cold in the pit, and it never quite dries out.',
    karst: 'Damp and cold underground, and it never quite dries out.',
    cabin: 'Freezing. Nights take health directly, and a fire is the difference.',
    magmatube: 'Furnace heat, underground, and it gets worse the further down you go.',
    solar: 'Desert heat. Water is the whole game and there is not much of it.',
    saltflats: 'Desert heat. Water is the whole game and there is not much of it.',
    'procedural-dunes': 'Desert heat. Water is the whole game and there is not much of it.',
    toxic: 'Wet, warm and foul. Open water here is not safe to drink.',
    sporefields: 'Wet, warm and foul. Open water here is not safe to drink.',
    craterfield: 'Wet, warm and foul. Open water here is not safe to drink.',
    'procedural-rainforest': 'Wet, warm and foul. Open water here is not safe to drink.',
    'procedural-bayou': 'Wet, warm and foul. Open water here is not safe to drink.',
    tempest: 'Storm-bound. The weather is the arena, and it does not stall for long.',
    kelvin: 'Freezing. Nights take health directly, and a fire is the difference.',
    silkwood: 'Wet, warm and foul. Open water here is not safe to drink.',
    nooneplace: 'Perpetual dusk. It has been the last minute before dark for eleven days.',
    redcathedral: 'Desert heat. Water is the whole game and there is not much of it.',
    'procedural-archipelago': 'Storm-bound. The weather is the arena, and it does not stall for long.',
    // §1 (requests): the five new arenas.
    tidewrack: 'Storm-bound and tidal. The map is a different map twice a day.',
    thresher: 'Furnace heat, indoors, all day and all night.',
    vigil: 'Perpetual dusk. It has been the last minute before dark for eleven days.',
    saltworks: 'Desert heat. Water is the whole game and there is not much of it.',
    kiln: 'Furnace heat, and two suns over it. There is no shade above ground.',
};

const TERRAIN_LABELS: Record<Terrain, string> = {
    open: 'open ground',
    forest: 'forest',
    water: 'water',
    highland: 'high ground',
    ruins: 'ruins',
    wetland: 'wetland',
    cave: 'cave systems',
    ice: 'ice',
    desert: 'desert',
    urban: 'streets',
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
