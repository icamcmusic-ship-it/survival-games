/**
 * CONTENT-10: a named Head Gamemaker, chosen once per run.
 *
 * Every run's Gamemakers behaved identically — same boredom threshold, same
 * weather odds, same hazard curve, regardless of who was nominally running
 * the Games. A name and a personality is an enormous replayability lever for
 * very little content: the same cast and the same arena play differently
 * under a Gamemaker who loves fire and one who loves mutts.
 */
export interface HeadGamemakerProfile {
    name: string;
    /** One line, shown in the roster header and read at the reaping. */
    style: string;
    /** Multiplier on how quickly boredom triggers escalation. Below 1 = patient. */
    boredomMultiplier: number;
    /** Multiplier on hazard and mutt frequency once escalated. */
    hazardMultiplier: number;
    /** Flavour line fired once, at the start of the Games. */
    openingLine: string;
    /**
     * The one thing this Gamemaker actually does, once per run, when the feed
     * needs them to. Nine named Gamemakers who differed only by two multipliers
     * were a name and a tooltip; a signature intervention is what makes the
     * choice of Head Gamemaker something a player can recognise happening.
     */
    signature: GamemakerSignature;
    /** How the intervention is announced in the chronicle. */
    signatureLine: string;
}

/** What a Head Gamemaker reaches for when the Games need help. See `engine/gamemakerAgency.ts`. */
export type GamemakerSignature =
    | 'release-mutts'      // Dray: mutts, early and often
    | 'weather-front'      // Cray: the climate budget, spent
    | 'call-the-feast'     // Voss: a staged, photogenic convergence
    | 'close-the-border'   // Kestrel: impatience, expressed as geography
    | 'spare-the-young'    // Osric: a parachute to the youngest tribute alive
    | 'do-nothing'         // Haymes: conspicuously, and on the record
    | 'grind';             // Ainsel: the arena itself, turned up a notch

export const HEAD_GAMEMAKERS: HeadGamemakerProfile[] = [
    {
        name: 'Seneca Voss',
        style: 'loves a clean, photogenic kill',
        boredomMultiplier: 1.1,
        hazardMultiplier: 1.0,
        openingLine: 'Head Gamemaker Seneca Voss wants a beautiful Games this year — memorable, telegraphed, nothing wasted.',
        signature: 'call-the-feast',
        signatureLine: 'Seneca Voss calls the tributes to the Cornucopia, because a Games without a set piece is a Games nobody rewatches.',
    },
    {
        name: 'Plutarch Haymes',
        style: 'plays the long game and lets the tributes do the work',
        boredomMultiplier: 0.75,
        hazardMultiplier: 0.85,
        openingLine: 'Head Gamemaker Plutarch Haymes is on record saying the best arena is the one you barely have to touch.',
        signature: 'do-nothing',
        signatureLine: 'Plutarch Haymes is asked, live, when he intends to intervene. He says the arena is doing fine on its own, and does not intervene.',
    },
    {
        name: 'Coriolanus Dray',
        style: 'has never met a mutt he did not want to release early',
        boredomMultiplier: 1.0,
        hazardMultiplier: 1.35,
        openingLine: 'Head Gamemaker Coriolanus Dray has requested three separate mutt roster reviews this week alone.',
        signature: 'release-mutts',
        signatureLine: 'Coriolanus Dray signs the release order personally. He has been waiting all week for a reason.',
    },
    {
        name: 'Larkspur Ainsel',
        style: 'runs a slow, grinding Games and calls it artistry',
        boredomMultiplier: 0.6,
        hazardMultiplier: 0.7,
        openingLine: 'Head Gamemaker Larkspur Ainsel prefers to let the arena itself do the talking, at length.',
        signature: 'grind',
        signatureLine: 'Larkspur Ainsel adjusts nothing dramatic. The water goes a little further away, the nights get a little colder, and everybody gets a little worse.',
    },
    {
        name: 'Fennimore Cray',
        style: 'has a well-documented weakness for weather',
        boredomMultiplier: 1.15,
        hazardMultiplier: 1.1,
        openingLine: 'Head Gamemaker Fennimore Cray has spent more of this year\'s budget on climate systems than on anything else.',
        signature: 'weather-front',
        signatureLine: 'Fennimore Cray finally gets to use the weather systems he spent the budget on, and uses all of them at once.',
    },
    {
        name: 'Ivo Kestrel',
        style: 'is impatient and it shows in the escalation schedule',
        boredomMultiplier: 1.5,
        hazardMultiplier: 1.25,
        openingLine: 'Head Gamemaker Ivo Kestrel has told the press, more than once, that a slow Games is a failed Games.',
        signature: 'close-the-border',
        signatureLine: 'Ivo Kestrel brings the schedule forward. The arena is smaller this evening than it was this morning, and it will be smaller again tomorrow.',
    },
    {
        name: 'Marigold Osric',
        style: 'is known for mercy toward the young and none for anyone else',
        boredomMultiplier: 0.9,
        hazardMultiplier: 1.0,
        openingLine: 'Head Gamemaker Marigold Osric\'s Games are, by Capitol standards, considered soft on the youngest tributes — and brutal on everyone else.',
        signature: 'spare-the-young',
        signatureLine: 'A parachute comes down for the youngest tribute still breathing. Marigold Osric does not explain it and nobody asks her to.',
    },
];

export function gamemakerProfile(name: string | undefined): HeadGamemakerProfile {
    return HEAD_GAMEMAKERS.find(g => g.name === name) ?? HEAD_GAMEMAKERS[0];
}
