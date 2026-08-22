/**
 * REPLAY-01: what makes the 74th Games different from the 75th.
 *
 * Measured, before this: mean 8.0 days, a tight 5-14 spread, the same escalation
 * schedule, the same sponsor climate, the same everything. The names changed and
 * the story did not. A simulation whose selling point is replayability cannot
 * have one shape.
 *
 * A profile is rolled once per run from the seed and announced at the reaping,
 * the way the Capitol announces a Quarter Quell — so the player forms a
 * different expectation before the gong, which is the whole prediction loop.
 * Each field is a multiplier on machinery that already exists rather than a new
 * subsystem, so a profile cannot break a run, only colour it.
 */

import type { ArenaLawId, GameConfig } from '../models/types';

export interface GamesTemperament {
    id: string;
    /** Headline, as the Capitol would print it. */
    name: string;
    /** One line of announcement copy, read at the reaping. */
    blurb: string;
    /** Multiplier on hazard and mutt frequency. */
    hazardRate: number;
    /** Multiplier on the sponsor gift stream. */
    sponsorGenerosity: number;
    /** Multiplier on alliance betrayal odds. */
    betrayalRate: number;
    /** Days added to (or taken off) the scheduled border collapse. */
    escalationShift: number;
}

/**
 * Deliberately not symmetric. A "generous" Games and a "starving" Games should
 * produce visibly different chronicles, not the same chronicle with a different
 * label — so the multipliers are large enough to change what kills people.
 */
export const GAMES_TEMPERAMENTS: GamesTemperament[] = [
    {
        id: 'standard',
        name: 'a conventional Games',
        blurb: 'The Capitol has promised nothing unusual this year, which is itself a kind of promise.',
        hazardRate: 1, sponsorGenerosity: 1, betrayalRate: 1, escalationShift: 0,
    },
    {
        id: 'lean',
        name: 'a lean Games',
        blurb: 'Sponsorship is down across every district. Whatever these tributes find out there is what they will have.',
        hazardRate: 1, sponsorGenerosity: 0.55, betrayalRate: 1.25, escalationShift: 0,
    },
    {
        id: 'lavish',
        name: 'a lavish Games',
        blurb: 'Capitol money is pouring in this year. Parachutes are expected to be frequent and expensive.',
        hazardRate: 1, sponsorGenerosity: 1.6, betrayalRate: 0.85, escalationShift: 1,
    },
    {
        id: 'hostile',
        name: 'a hostile arena',
        blurb: 'The Gamemakers have built something with genuine teeth this year. The arena itself is expected to be the story.',
        hazardRate: 1.5, sponsorGenerosity: 1.15, betrayalRate: 0.9, escalationShift: 0,
    },
    {
        id: 'merciful',
        name: 'a slow Games',
        blurb: 'A quiet arena, a long schedule, and a Capitol audience that will get bored well before the tributes do.',
        hazardRate: 0.65, sponsorGenerosity: 1, betrayalRate: 1, escalationShift: 2,
    },
    {
        id: 'treacherous',
        name: 'a treacherous Games',
        blurb: 'Something in the pre-Games has soured every alliance on the training floor before it was ever made.',
        hazardRate: 1, sponsorGenerosity: 1, betrayalRate: 1.9, escalationShift: 0,
    },
    {
        id: 'compressed',
        name: 'a short Games',
        blurb: 'The Capitol has scheduled these Games tight. The border is expected to move early and keep moving.',
        hazardRate: 1.25, sponsorGenerosity: 1.1, betrayalRate: 1.1, escalationShift: -2,
    },
    // §10.1: the run-length band was narrow — almost every Games had the same
    // shape (bloodbath, quiet days, escalation, feast, finale). These two are
    // the extremes the distribution was missing: a compressed, brutal Games
    // with no time for alliances, and a long attrition Games where tributes
    // can go days without meeting.
    {
        id: 'blitz',
        name: 'a blitz Games',
        blurb: 'The President wants it over by the weekend, and the Gamemakers have built an arena that agrees with him. Nobody expects alliances to matter this year.',
        hazardRate: 1.6, sponsorGenerosity: 1.2, betrayalRate: 1.3, escalationShift: -4,
    },
    {
        id: 'attrition',
        name: 'an attrition Games',
        blurb: 'A vast, quiet arena and a Capitol prepared to wait. These Games will be won by whoever is still eating in week three.',
        hazardRate: 0.5, sponsorGenerosity: 0.7, betrayalRate: 0.9, escalationShift: 5,
    },
];

/**
 * The wildcard: one scheduled disruption per run, drawn from a pool wide enough
 * that a player who has watched ten runs has not seen all of them.
 *
 * Each one resolves through machinery that already exists — the feast phase, the
 * Gamemaker event triggers, the sponsor stream, the zone-effect system — so the
 * pool can be extended with data alone.
 */
export type WildcardKind =
    | 'early-feast' | 'double-feast' | 'no-feast'
    | 'mutt-release' | 'supply-drop' | 'weather-front'
    | 'sponsor-freeze' | 'sponsor-flood'
    | 'gamemaker-malfunction' | 'career-collapse'
    | 'rule-change-allies' | 'rule-change-no-allies'
    | 'blackout' | 'drought' | 'bounty'
    | 'quarter-quell-pairs' | 'quarter-quell-doubled'
    | 'nothing' | 'silent-arena' | 'crowd-revolt'
    // Quell-only standing conditions (see QUELLS below). Never drawn from the
    // ordinary WILDCARDS pool — gamesProfileFor injects them directly into a
    // run's calendar when the matching Quell is rolled, so they can never
    // appear on a non-Quell run.
    | 'quell-alliance-cap' | 'quell-mandatory-partner' | 'quell-sponsors-by-vote'
    | 'quell-cornucopia-forfeit' | 'quell-moving-arena' | 'quell-two-victors'
    | 'quell-bounty-rotating' | 'quell-long-games' | 'quell-feast-nightly'
    | 'quell-reflection' | 'quell-weapons-fixed' | 'quell-blood-debt'
    /**
     * A Quell whose only lever is `castShapeOverride`/`temperamentOverride`/
     * `configOverride` has nothing to put in `standingWildcards` — but that
     * used to mean it got no calendar entry at all, so its own announcement
     * never appeared on the reaping screen (`calendarOf`) and its headline
     * `wildcard.kind` fell back to `'nothing'`, which every "is this Games a
     * Quell" check elsewhere (the in-run sidebar, the "A Quarter Quell"
     * achievement) reads as "no Quell". `quellWildcards` below now emits one
     * of these for any Quell with no mechanical standing wildcard, purely so
     * the Quell is visible — nothing reads this kind for behaviour.
     */
    | 'quell-standing';

export interface Wildcard {
    kind: WildcardKind;
    name: string;
    /** Read at the reaping, before anybody knows what it will mean. */
    announcement: string;
    /** Fired on the day it lands, in the chronicle. */
    onFire?: string;
    /** Day it resolves. 0 = it is a standing condition rather than an event. */
    day: number;
}

export interface WildcardDef {
    kind: WildcardKind;
    name: string;
    announcement: string;
    onFire?: string;
    /** Earliest and latest day this can land. [0, 0] = standing condition. */
    window: [number, number];
    /** Relative draw weight. `nothing` is common on purpose. */
    weight: number;
}

export const WILDCARDS: WildcardDef[] = [
    {
        kind: 'nothing', name: 'no special provision',
        announcement: 'These Games carry no special provision. The rules are the rules.',
        window: [0, 0], weight: 6,
    },
    {
        kind: 'early-feast', name: 'an early feast',
        announcement: 'The Capitol has announced a feast far earlier than usual. Nobody is pretending it is generosity.',
        onFire: 'The feast horn sounds days before anyone expected it. Half the field is still carrying its bloodbath wounds.',
        window: [2, 3], weight: 3,
    },
    {
        kind: 'double-feast', name: 'two feasts',
        announcement: 'Two feasts are scheduled this year. The Gamemakers have been very clear that attendance is optional.',
        onFire: 'The horn sounds a second time. The Cornucopia has not finished being dangerous from the first one.',
        window: [4, 6], weight: 2,
    },
    {
        kind: 'no-feast', name: 'no feast at all',
        announcement: 'There will be no feast this year. Whatever the tributes need, they will find it themselves or do without.',
        window: [0, 0], weight: 2,
    },
    {
        kind: 'mutt-release', name: 'a scheduled mutt release',
        announcement: 'The Gamemakers have confirmed a scheduled release. They have not confirmed of what.',
        onFire: 'Somewhere along the perimeter, a gate opens on a timer nobody in the arena knew about.',
        window: [3, 6], weight: 3,
    },
    {
        kind: 'supply-drop', name: 'an unclaimed supply drop',
        announcement: 'A supply drop is scheduled mid-Games, unaddressed. Whoever reaches it first owns it.',
        onFire: 'Parachutes come down all across the arena at once, none of them addressed to anybody.',
        window: [3, 6], weight: 3,
    },
    {
        kind: 'weather-front', name: 'a scheduled weather front',
        announcement: 'The forecast for the arena has been published in advance this year, which the Capitol finds very funny.',
        onFire: 'The weather front arrives exactly when the Capitol said it would, which does not help anyone standing in it.',
        window: [3, 7], weight: 3,
    },
    {
        kind: 'sponsor-freeze', name: 'a sponsorship freeze',
        announcement: 'Sponsorship has been suspended for the opening days. The Capitol has offered no reason.',
        onFire: 'The freeze lifts. Every mentor in the Capitol starts working the room at once.',
        window: [3, 4], weight: 2,
    },
    {
        kind: 'sponsor-flood', name: 'a sponsorship surge',
        announcement: 'An unusual amount of Capitol money has been committed to these Games before they have even begun.',
        window: [0, 0], weight: 2,
    },
    {
        kind: 'gamemaker-malfunction', name: 'a Gamemaker malfunction',
        announcement: 'The arena systems have been flagged as unstable. The Capitol insists this is nothing.',
        onFire: 'Something in the arena machinery fails audibly, and for a few hours nobody in the control room is sure what the arena is going to do.',
        window: [4, 7], weight: 2,
    },
    {
        kind: 'career-collapse', name: 'a fractured Career pack',
        announcement: 'Something happened between the Career districts at the Remake Center, and nobody is saying what.',
        onFire: 'Whatever was holding the Career pack together stops holding.',
        window: [2, 4], weight: 2,
    },
    {
        kind: 'rule-change-allies', name: 'a rule change: two may win',
        announcement: 'A rule change has been announced: two tributes may be crowned, if both are still standing at the end.',
        window: [0, 0], weight: 2,
    },
    {
        kind: 'rule-change-no-allies', name: 'a rule change: no alliances',
        announcement: 'A rule change has been announced: alliances are forbidden this year. Enforcement is described as "automatic".',
        window: [0, 0], weight: 1,
    },
    {
        kind: 'blackout', name: 'an extended night',
        announcement: 'The Gamemakers have scheduled an extended darkness. The arena lights will simply not come up.',
        onFire: 'The arena lights do not come up. Whatever else happens today, it happens in the dark.',
        window: [3, 6], weight: 2,
    },
    {
        kind: 'drought', name: 'a scheduled drought',
        announcement: 'The arena water table has been adjusted downward. The Capitol describes this as "a design choice".',
        onFire: 'The water goes. Streams that ran yesterday are dry stone this morning.',
        window: [3, 6], weight: 2,
    },
    {
        kind: 'bounty', name: 'a bounty',
        announcement: 'A bounty has been placed on a tribute, to be announced once the Games are under way.',
        onFire: 'The Capitol names a tribute and attaches a number to them. Every sponsor in the city is now watching one person.',
        window: [3, 6], weight: 2,
    },
    {
        kind: 'quarter-quell-pairs', name: 'a Quarter Quell: district pairs',
        announcement: 'QUARTER QUELL: as a reminder that the districts stand together or not at all, tributes will be reaped in bonded pairs.',
        window: [0, 0], weight: 1,
    },
    {
        kind: 'quarter-quell-doubled', name: 'a Quarter Quell: a harder arena',
        announcement: 'QUARTER QUELL: as a reminder that the Capitol\'s reach exceeds the districts\' grasp, this arena has been built without mercy.',
        window: [0, 0], weight: 1,
    },
    {
        kind: 'silent-arena', name: 'a silent arena',
        announcement: 'There will be no anthem and no faces in the sky this year. Tributes will learn who is left the hard way.',
        window: [0, 0], weight: 1,
    },
    {
        kind: 'crowd-revolt', name: 'an audience that has lost patience',
        announcement: 'Capitol viewing figures are down. The Gamemakers have been told, in writing, to fix it.',
        onFire: 'The Capitol turns on its own favourites without warning. Whoever the cameras have been carrying is about to find out what that is worth.',
        // Was [0, 0] — a "standing" day, which `fireScheduledWildcard` never
        // resolves (it returns before the switch for any day-0 entry). The
        // sponsor-swing event this kind actually implements in
        // `engine/wildcards.ts` was consequently dead code: it was drawn,
        // announced, and then never once fired. `configForProfile`'s hazard
        // multiplier for this kind is day-independent and keeps applying
        // exactly as before; giving it a real window on top of that is what
        // makes it "fire" as an event during the run, the way its case in
        // `resolveWildcard` was always written to.
        window: [4, 8], weight: 2,
    },
];

/**
 * REPLAY-09: the shape of the cast itself.
 *
 * Every reaping produced the same statistical field — a uniform age roll, the
 * same archetype odds, the same three Career districts — so the roster screen
 * never varied even though the seed did. A cast shape is rolled once from the
 * seed and biases the whole draw, so an unusually young field, an all-volunteer
 * year, or a reaping stacked with Careers is something a player can actually
 * encounter and recognise.
 */
export type CastShapeId =
    | 'ordinary' | 'young-field' | 'veteran-field' | 'all-volunteer'
    | 'career-heavy' | 'outer-districts' | 'bonded-pairs' | 'victors-field';

export interface CastShape {
    id: CastShapeId;
    name: string;
    /** Read at the reaping, so the player knows what they are looking at. */
    blurb: string;
    /** Years shifted onto every age roll, before the band is clamped. */
    ageShift: number;
    /** Odds any given tribute volunteered rather than being reaped. */
    volunteerChance: number;
    /** Extra weight on the Career archetype outside the Career districts. */
    careerBias: number;
    /** Flat bonus to every attribute roll — a field that is simply better. */
    talentBonus: number;
    /** District partners start bonded, at this relationship value. */
    pairBond: number;
    weight: number;
}

export const CAST_SHAPES: CastShape[] = [
    {
        id: 'ordinary', name: 'an ordinary reaping',
        blurb: 'Twenty-four names out of twenty-four bowls. Nothing about the draw is remarkable, which is its own kind of cruelty.',
        ageShift: 0, volunteerChance: 0, careerBias: 0, talentBonus: 0, pairBond: 0, weight: 10,
    },
    {
        id: 'young-field', name: 'an unusually young field',
        blurb: 'The bowls come up young this year. Half this cast has never been eligible before, and the Capitol is delighted.',
        ageShift: -2, volunteerChance: 0, careerBias: -0.15, talentBonus: 0, pairBond: 0, weight: 3,
    },
    {
        id: 'veteran-field', name: 'a field of eighteens',
        blurb: 'Almost every name drawn is in their last year of eligibility. This is the oldest, largest cast in recent memory.',
        ageShift: 2, volunteerChance: 0.15, careerBias: 0.1, talentBonus: 0.5, pairBond: 0, weight: 3,
    },
    {
        id: 'all-volunteer', name: 'an all-volunteer year',
        blurb: 'Not one tribute this year was reaped. Every single one of them stepped forward, and nobody in the Capitol is asking why.',
        ageShift: 1, volunteerChance: 1, careerBias: 0.2, talentBonus: 0.75, pairBond: 0, weight: 2,
    },
    {
        id: 'career-heavy', name: 'a reaping stacked with Careers',
        blurb: 'The academies have had a good year, and it shows across districts that do not have academies.',
        ageShift: 1, volunteerChance: 0.4, careerBias: 0.45, talentBonus: 0.4, pairBond: 0, weight: 2,
    },
    {
        id: 'outer-districts', name: 'a year the outer districts fear',
        blurb: 'The Career districts have drawn poorly and the outer districts have not. The odds board is going to look very strange.',
        ageShift: 0, volunteerChance: 0, careerBias: -0.3, talentBonus: 0, pairBond: 0, weight: 2,
    },
    {
        id: 'bonded-pairs', name: 'a reaping of bonded pairs',
        blurb: 'Each district sends two who already know each other, and the Capitol has made very sure everybody understands what that means.',
        ageShift: 0, volunteerChance: 0, careerBias: 0, talentBonus: 0, pairBond: 70, weight: 2,
    },
    {
        // Quell-only — the "Victors' Field" Quell below is the sole source of
        // this shape (weight 0 keeps it out of the ordinary weighted draw).
        id: 'victors-field', name: 'a field of victors',
        blurb: 'Every tribute this year has done this before. Whatever they learned the first time, they brought it back with them.',
        ageShift: 3, volunteerChance: 0, careerBias: 0.1, talentBonus: 1.6, pairBond: 25, weight: 0,
    },
];

/**
 * A Quarter Quell: a structural change to the reaping, the arena's rules, or
 * the win condition for one run — not a hazard multiplier. `quarter-quell-pairs`
 * and `quarter-quell-doubled` already exist as ordinary `WildcardDef` entries
 * (drawn like "an early feast"); a Quell wraps one or more standing
 * conditions into a single named, announced package, and is drawn from its
 * own low-weight pool in `gamesProfileFor` (engine/gamesProfile.ts) rather
 * than the general wildcard calendar, so it composes with (and doesn't
 * crowd out) that run's own wildcard beats.
 *
 * Preferred mechanism is `standingWildcards`: reuse an existing `WildcardKind`
 * (or one of the `quell-*` kinds above) wherever one already does the job, so
 * every consumer that already checks `wildcardIs`/`calendarOf` picks the
 * Quell up for free. `castShapeOverride`/`temperamentOverride`/`configOverride`/
 * `arenaLawOverride` are for the handful of Quells that need a lever no
 * wildcard already provides.
 */
export interface Quell {
    id: string;
    name: string;
    /** Read at the reaping, in the Capitol's own voice. */
    announcement: string;
    standingWildcards?: WildcardKind[];
    castShapeOverride?: CastShapeId;
    temperamentOverride?: Partial<GamesTemperament>;
    configOverride?: Partial<GameConfig>;
    arenaLawOverride?: ArenaLawId;
    /** Relative draw weight within the Quell pool (not the ordinary wildcard pool). */
    weight: number;
}

/**
 * REPLAY-11/S-4: 28 Quells (of an original 22 — "No Victor" and "The Mentors'
 * Quell" were cut as needing a hidden-win-condition system and a one-off
 * mentor-intervention system respectively, neither of which exists yet — plus
 * 8 added later reusing the ordinary wildcard pool and the arena-law system,
 * both already fully mechanical). "Bonded Pairs" and "The Silent Games" wrap
 * wildcards that already have full mechanical effects (see
 * gamesProfile.ts/victory.ts/dayNight.ts) —
 * everything else here is genuinely new, gated on its own `quell-*` kind.
 */
export const QUELLS: Quell[] = [
    {
        id: 'bonded-pairs', name: 'Bonded Pairs',
        announcement: 'QUARTER QUELL: tributes will be reaped in bonded pairs from each district.',
        standingWildcards: ['quarter-quell-pairs'],
        weight: 3,
    },
    {
        id: 'victors-field', name: "Victors' Field",
        announcement: "QUARTER QUELL: as a reminder that no Games are ever truly over, this year's pool is drawn from the ranks of past victors.",
        castShapeOverride: 'victors-field',
        weight: 2,
    },
    {
        id: 'doubled-reaping', name: 'The Doubled Reaping',
        announcement: 'QUARTER QUELL: as a reminder that the Capitol can always ask for more, every district will send its full complement — forty-eight tributes will enter the arena.',
        configOverride: { districtCount: 12 },
        temperamentOverride: { hazardRate: 1.6, betrayalRate: 1.2, escalationShift: -3, sponsorGenerosity: 1 },
        weight: 2,
    },
    {
        id: 'no-alliances', name: 'No Alliances',
        announcement: 'QUARTER QUELL: any alliance of more than two will be punished by the Gamemakers themselves.',
        standingWildcards: ['quell-alliance-cap'],
        weight: 2,
    },
    {
        id: 'mandatory-alliance', name: 'The Mandatory Alliance',
        announcement: 'QUARTER QUELL: every tribute must remain within one zone of their district partner, or be marked.',
        standingWildcards: ['quell-mandatory-partner'],
        weight: 2,
    },
    {
        id: 'silent-games', name: 'The Silent Games',
        announcement: 'QUARTER QUELL: there will be no cannons, no faces in the sky, and no death announcements this year.',
        standingWildcards: ['silent-arena'],
        weight: 2,
    },
    {
        id: 'sponsors-quell', name: "The Sponsors' Quell",
        announcement: 'QUARTER QUELL: sponsor gifts will be decided by a vote of the Capitol audience, not bought.',
        standingWildcards: ['quell-sponsors-by-vote'],
        weight: 2,
    },
    {
        id: 'volunteers-quell', name: "The Volunteers' Quell",
        announcement: 'QUARTER QUELL: every district must send a volunteer this year, or forfeit its tribute entirely.',
        castShapeOverride: 'career-heavy',
        weight: 1,
    },
    {
        id: 'the-youngest', name: 'The Youngest',
        announcement: 'QUARTER QUELL: every tribute this year will be reaped from the youngest eligible age.',
        castShapeOverride: 'young-field',
        weight: 2,
    },
    {
        id: 'the-elders', name: "The Elders' Quell",
        announcement: 'QUARTER QUELL: every tribute this year will be reaped from the oldest eligible age.',
        castShapeOverride: 'veteran-field',
        weight: 2,
    },
    {
        id: 'cornucopia-forfeit', name: 'The Cornucopia Forfeit',
        announcement: 'QUARTER QUELL: there will be no weapons at the Cornucopia this year. Only food.',
        standingWildcards: ['quell-cornucopia-forfeit'],
        weight: 2,
    },
    {
        id: 'moving-arena', name: 'The Moving Arena',
        announcement: 'QUARTER QUELL: the arena will not be the same arena on the last day as it was on the first.',
        standingWildcards: ['quell-moving-arena'],
        weight: 2,
    },
    {
        id: 'two-victors', name: 'Two Victors',
        announcement: 'QUARTER QUELL: the Capitol has promised that two tributes may live this year.',
        standingWildcards: ['quell-two-victors'],
        weight: 2,
    },
    {
        id: 'bounty-quell', name: 'The Bounty Quell',
        announcement: 'QUARTER QUELL: one tribute will be named the quarry. Whoever kills them will be fed for the rest of the Games.',
        standingWildcards: ['quell-bounty-rotating'],
        weight: 2,
    },
    {
        id: 'tributes-choice', name: "The Tribute's Choice",
        announcement: 'QUARTER QUELL: each district will choose its own tribute, by open vote.',
        castShapeOverride: 'all-volunteer',
        weight: 1,
    },
    {
        id: 'long-games', name: 'The Long Games',
        announcement: 'QUARTER QUELL: the border of the arena will not move this year, whatever else happens inside it.',
        standingWildcards: ['quell-long-games'],
        temperamentOverride: { escalationShift: 999 },
        weight: 2,
    },
    {
        id: 'feast-quell', name: 'The Feast Quell',
        announcement: 'QUARTER QUELL: there will be a feast every night this year, and nothing else to eat.',
        standingWildcards: ['quell-feast-nightly'],
        weight: 2,
    },
    {
        id: 'the-reflection', name: 'The Reflection',
        announcement: 'QUARTER QUELL: each tribute will face a mutt wearing their own face.',
        standingWildcards: ['quell-reflection'],
        weight: 2,
    },
    {
        id: 'weapons-quell', name: 'The Weapons Quell',
        announcement: "QUARTER QUELL: each tribute will arrive with their district's own tool, and nothing else.",
        standingWildcards: ['quell-weapons-fixed'],
        weight: 2,
    },
    {
        id: 'blood-debt', name: 'The Blood Debt',
        announcement: 'QUARTER QUELL: a tribute who kills is marked. The Capitol pays the marked less.',
        standingWildcards: ['quell-blood-debt'],
        weight: 2,
    },
    // S-4: a second wave of Quells, on top of the original 20 — reusing
    // machinery the ordinary wildcard pool and the arena-law system already
    // have, exactly the way the block comment above this array asks for.
    {
        id: 'feral-quell', name: 'The Feral Quell',
        announcement: 'QUARTER QUELL: alliances are forbidden this year, absolutely — not capped, not discouraged, forbidden. The Gamemakers have promised zero tolerance.',
        // Distinct from 'No Alliances' above: that one caps a pack at two
        // (`quell-alliance-cap`) and taxes anyone over it. This is the
        // ordinary `rule-change-no-allies` wildcard — a flat ban, plus the
        // 2.5x betrayal-rate multiplier `configForProfile` already applies
        // to it — promoted to a guaranteed standing condition.
        standingWildcards: ['rule-change-no-allies'],
        weight: 2,
    },
    {
        id: 'lean-quell', name: 'The Lean Quell',
        announcement: 'QUARTER QUELL: there will be no feast this year, at any point. Whatever the tributes need, the arena itself will have to provide it — or nobody will.',
        standingWildcards: ['no-feast'],
        weight: 2,
    },
    {
        id: 'open-wallet-quell', name: "The Capitol's Generosity",
        announcement: "QUARTER QUELL: the Capitol has ordered unlimited sponsorship this year. Every mentor in the city has already spent their allowance twice over before the gong.",
        standingWildcards: ['sponsor-flood'],
        weight: 2,
    },
    {
        id: 'endless-day-quell', name: 'The Quell That Never Sleeps',
        announcement: 'QUARTER QUELL: the arena will not permit a single night this year. There is no rest, at any hour, for anyone.',
        arenaLawOverride: 'noNight',
        weight: 2,
    },
    {
        id: 'cold-quell', name: 'The Cold Quell',
        announcement: 'QUARTER QUELL: no flame will catch in this arena, all year — no fire, no light, no warmth but what a tribute carries in themselves.',
        arenaLawOverride: 'fireImpossible',
        weight: 2,
    },
    {
        id: 'feeding-ground-quell', name: 'The Feeding Ground',
        announcement: 'QUARTER QUELL: the Cornucopia will restock all year, not just once at the start. Whoever controls it controls everything.',
        arenaLawOverride: 'cornucopiaRefills',
        weight: 2,
    },
    {
        id: 'single-drop-zone-quell', name: 'The Single Drop Zone',
        announcement: 'QUARTER QUELL: sponsor gifts will only reach one place in this arena, all year. Everyone who wants Capitol help will have to come to it.',
        arenaLawOverride: 'sponsorsFixedZone',
        weight: 2,
    },
    {
        id: 'thirst-quell', name: 'The Thirst Quell',
        announcement: 'QUARTER QUELL: water in this arena comes from exactly one place this year, and every tribute knows exactly where to find it.',
        arenaLawOverride: 'noWaterExceptZone',
        weight: 2,
    },
];
