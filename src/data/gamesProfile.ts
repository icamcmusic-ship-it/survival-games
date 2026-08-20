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
    | 'nothing' | 'silent-arena' | 'crowd-revolt';

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
        window: [0, 0], weight: 2,
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
    | 'career-heavy' | 'outer-districts' | 'bonded-pairs';

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
];
