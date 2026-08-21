/**
 * §10.2: the modifier layer, orthogonal to `GamesProfile`.
 *
 * Temperament says how hard this year is; the wildcard says what happens on
 * day five; the cast shape says who got reaped. None of them changes the
 * *rules of the show*, so every Games still had a Cornucopia, an anthem, a
 * sponsor economy and a feast, and ~9 days of the same shape. A modifier is a
 * standing structural change to the format, rolled 1-3 per run from a pool
 * wide enough that a player who has seen twenty runs has not seen every
 * combination.
 *
 * Each one resolves through machinery that already exists — the sponsor
 * stream, the feast scheduler, the collapse system, the anthem, the mutt
 * roster — so the pool extends with data rather than with engine work.
 */

export type ModifierId =
    | 'no-sponsors'
    | 'no-feast'
    | 'no-anthem'
    | 'all-volunteer'
    | 'half-arena'
    | 'doubled-mutts'
    | 'no-cornucopia'
    | 'sudden-death'
    | 'rich-arena'
    | 'open-borders'
    | 'no-mentors'
    | 'twin-victors';

export interface GamesModifier {
    id: ModifierId;
    /** What the Capitol calls it, read out at the reaping. */
    name: string;
    /** One line of announcement copy. */
    blurb: string;
    /** Relative draw weight. Rare ones are meant to be rare. */
    weight: number;
    /**
     * Modifiers that cannot sit alongside this one. "No feast" and "two
     * feasts" is not a format, it is a contradiction.
     */
    excludes?: ModifierId[];
}

export const GAMES_MODIFIERS: GamesModifier[] = [
    {
        id: 'no-sponsors',
        name: 'a sealed sponsorship year',
        blurb: 'The sponsorship floor is closed by decree this year. Whatever these tributes find in the arena is all they are getting.',
        weight: 10,
        excludes: ['rich-arena'],
    },
    {
        id: 'no-feast',
        name: 'no feast',
        blurb: 'The Gamemakers have announced there will be no feast — and, in the same breath, that the arena will be closing early instead. Nobody is being called anywhere. Everyone is being pushed.',
        // The feast is the engine's main forced convergence: measured, a
        // no-feast year ran at 50% bloodless victors against a field average
        // of 32%, because nothing was left to make anybody meet. The
        // Gamemakers still have to end the show, so a year without a feast is
        // a year the border comes forward — see `escalationShiftFor`.
        weight: 6,
        excludes: ['no-cornucopia'],
    },
    {
        id: 'no-anthem',
        name: 'a silent sky',
        blurb: 'There will be no anthem and no faces in the sky. The tributes will find out who is left the way everyone else in the arena does.',
        weight: 8,
    },
    {
        id: 'all-volunteer',
        name: 'an all-volunteer field',
        blurb: 'Every district put a volunteer forward this year. Not one name in the bowls was needed, and the Capitol has not stopped talking about it.',
        weight: 6,
    },
    {
        id: 'half-arena',
        name: 'a half-size arena',
        blurb: 'The arena the Gamemakers built is barely half the usual ground. There is nowhere in it that is far from anywhere else.',
        weight: 8,
        excludes: ['open-borders'],
    },
    {
        id: 'doubled-mutts',
        name: 'a doubled mutt roster',
        blurb: 'The mutt labs delivered twice what they were asked for, and the Gamemakers have decided to use all of it.',
        weight: 8,
    },
    {
        id: 'no-cornucopia',
        name: 'an empty Cornucopia',
        blurb: 'The horn stands at the centre of the arena with nothing in it. The bloodbath this year is over ground, not supplies — and the Capitol has promised the feast will make up for it.',
        weight: 5,
        // An empty horn AND no feast is an arena with nothing to converge on
        // at all, which measured as the least eventful format the pool could
        // produce. Supplies have to enter the arena somewhere.
        excludes: ['rich-arena', 'no-feast'],
    },
    {
        id: 'sudden-death',
        name: 'a compressed schedule',
        blurb: 'The border starts closing on the first night. The Capitol has other programming this week.',
        weight: 6,
    },
    {
        id: 'rich-arena',
        name: 'a well-stocked arena',
        blurb: 'The Gamemakers have seeded the arena generously. There is enough out there for everyone, which has never once stopped anybody.',
        weight: 7,
    },
    {
        id: 'open-borders',
        name: 'an unbounded arena',
        blurb: 'No border will close this year. The Gamemakers have promised the tributes all the room they want and all the time they can stand.',
        // Rare on purpose: with no border there is no pressure to finish, and
        // the run tends toward a victor who simply outlasted everyone.
        weight: 3,
        excludes: ['sudden-death'],
    },
    {
        id: 'no-mentors',
        name: 'a year without mentors',
        blurb: 'The mentors have been barred from the sponsor floor. Nobody in the Capitol is arguing anybody\'s case this year.',
        weight: 6,
    },
    {
        id: 'twin-victors',
        name: 'a standing two-victor rule',
        blurb: 'The rule is announced before the gong rather than halfway through: two may win, and they need not be from the same district.',
        weight: 5,
    },
];

export function modifierById(id: ModifierId): GamesModifier | undefined {
    return GAMES_MODIFIERS.find(m => m.id === id);
}
