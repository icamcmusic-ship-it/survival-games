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
}

export const HEAD_GAMEMAKERS: HeadGamemakerProfile[] = [
    {
        name: 'Seneca Voss',
        style: 'loves a clean, photogenic kill',
        boredomMultiplier: 1.1,
        hazardMultiplier: 1.0,
        openingLine: 'Head Gamemaker Seneca Voss wants a beautiful Games this year — memorable, telegraphed, nothing wasted.',
    },
    {
        name: 'Plutarch Haymes',
        style: 'plays the long game and lets the tributes do the work',
        boredomMultiplier: 0.75,
        hazardMultiplier: 0.85,
        openingLine: 'Head Gamemaker Plutarch Haymes is on record saying the best arena is the one you barely have to touch.',
    },
    {
        name: 'Coriolanus Dray',
        style: 'has never met a mutt he did not want to release early',
        boredomMultiplier: 1.0,
        hazardMultiplier: 1.35,
        openingLine: 'Head Gamemaker Coriolanus Dray has requested three separate mutt roster reviews this week alone.',
    },
    {
        name: 'Larkspur Ainsel',
        style: 'runs a slow, grinding Games and calls it artistry',
        boredomMultiplier: 0.6,
        hazardMultiplier: 0.7,
        openingLine: 'Head Gamemaker Larkspur Ainsel prefers to let the arena itself do the talking, at length.',
    },
    {
        name: 'Fennimore Cray',
        style: 'has a well-documented weakness for weather',
        boredomMultiplier: 1.15,
        hazardMultiplier: 1.1,
        openingLine: 'Head Gamemaker Fennimore Cray has spent more of this year\'s budget on climate systems than on anything else.',
    },
    {
        name: 'Ivo Kestrel',
        style: 'is impatient and it shows in the escalation schedule',
        boredomMultiplier: 1.5,
        hazardMultiplier: 1.25,
        openingLine: 'Head Gamemaker Ivo Kestrel has told the press, more than once, that a slow Games is a failed Games.',
    },
    {
        name: 'Marigold Osric',
        style: 'is known for mercy toward the young and none for anyone else',
        boredomMultiplier: 0.9,
        hazardMultiplier: 1.0,
        openingLine: 'Head Gamemaker Marigold Osric\'s Games are, by Capitol standards, considered soft on the youngest tributes — and brutal on everyone else.',
    },
];

export function gamemakerProfile(name: string | undefined): HeadGamemakerProfile {
    return HEAD_GAMEMAKERS.find(g => g.name === name) ?? HEAD_GAMEMAKERS[0];
}
