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
    {
        name: 'Vitellia Sarn',
        style: 'stages everything for the cameras and nothing for the tributes',
        boredomMultiplier: 1.2,
        hazardMultiplier: 0.95,
        openingLine: 'Head Gamemaker Vitellia Sarn ran the Capitol\'s biggest broadcast house before this. She has storyboards.',
        signature: 'call-the-feast',
        signatureLine: 'Vitellia Sarn convenes a feast timed to the minute of peak viewership. The table is lit like a stage, because it is one.',
    },
    {
        name: 'Cassius Brant',
        style: 'believes an arena should hurt everywhere, all the time',
        boredomMultiplier: 1.05,
        hazardMultiplier: 1.4,
        openingLine: 'Head Gamemaker Cassius Brant\'s last arena is still classified. The survivors of it do not give interviews.',
        signature: 'grind',
        signatureLine: 'Cassius Brant turns the arena up a degree at a time — the water further, the nights colder — and files it under maintenance.',
    },
    {
        name: 'Octavia Pell',
        style: 'floods her budget into spectacle weather',
        boredomMultiplier: 1.1,
        hazardMultiplier: 1.05,
        openingLine: 'Head Gamemaker Octavia Pell promised the press "skies nobody has ever seen." The forecast is classified.',
        signature: 'weather-front',
        signatureLine: 'Octavia Pell delivers the sky she promised. It arrives from the north wall, and it is not weather anyone has ever seen.',
    },
    {
        name: 'Tiberius Mane',
        style: 'breeds his own mutts and takes their losses personally',
        boredomMultiplier: 0.95,
        hazardMultiplier: 1.3,
        openingLine: 'Head Gamemaker Tiberius Mane came up through the mutt labs, and his creatures know his voice.',
        signature: 'release-mutts',
        signatureLine: 'Tiberius Mane opens the pens himself, without ceremony. He wants to watch his work run.',
    },
    {
        name: 'Aurelia Crest',
        style: 'closes ground like a chess player trading pieces',
        boredomMultiplier: 1.3,
        hazardMultiplier: 1.1,
        openingLine: 'Head Gamemaker Aurelia Crest plans arenas backwards from the final zone and works out what to take away, and when.',
        signature: 'close-the-border',
        signatureLine: 'Aurelia Crest retires a sector on schedule. Her schedule; nobody else has seen it.',
    },
    {
        name: 'Silvanus Reed',
        style: 'has never once been accused of mercy, except for the once',
        boredomMultiplier: 1.0,
        hazardMultiplier: 1.15,
        openingLine: 'Head Gamemaker Silvanus Reed does not answer questions about the parachute from three Games ago.',
        signature: 'spare-the-young',
        signatureLine: 'A parachute drifts down to the youngest tribute left alive. Silvanus Reed\'s office issues no statement, again.',
    },
    {
        name: 'Calpurnia Vex',
        style: 'trusts the field to make its own television',
        boredomMultiplier: 0.7,
        hazardMultiplier: 0.8,
        openingLine: 'Head Gamemaker Calpurnia Vex cut this year\'s intervention budget in half and dared anyone to complain about the ratings.',
        signature: 'do-nothing',
        signatureLine: 'Calpurnia Vex is offered a dozen interventions by her deputies. She initials none of them and orders dinner.',
    },
    {
        name: 'Drusus Hallow',
        style: 'is being audited, and it makes his Games nervous and loud',
        boredomMultiplier: 1.45,
        hazardMultiplier: 1.2,
        openingLine: 'Head Gamemaker Drusus Hallow needs a memorable Games this year, for reasons the Capitol gossip columns spell out daily.',
        signature: 'call-the-feast',
        signatureLine: 'Drusus Hallow calls a feast on a day nobody expected one. The columnists agree it smells of desperation, and watch anyway.',
    },
    {
        name: 'Sabina Thorn',
        style: 'grew up outside the Capitol and runs a cold, quiet arena',
        boredomMultiplier: 0.65,
        hazardMultiplier: 0.9,
        openingLine: 'Head Gamemaker Sabina Thorn does not do spectacle. Her Games end the way winters end: slowly, and then all at once.',
        signature: 'grind',
        signatureLine: 'Sabina Thorn lets the arena tighten like frost taking a window. Nobody can name the moment it got worse.',
    },
    {
        name: 'Publius Gaunt',
        style: 'is old enough to have run Games your mentors survived',
        boredomMultiplier: 0.85,
        hazardMultiplier: 1.0,
        openingLine: 'Head Gamemaker Publius Gaunt has outlasted four Presidents\' worth of fashions in arena design, and indulges none of them.',
        signature: 'close-the-border',
        signatureLine: 'Publius Gaunt closes the arena\'s edge the way he has closed forty arenas\' edges: early, evenly, and without comment.',
    },
    {
        name: 'Livia Ash',
        style: 'made her name on a wall of fire and has been chasing it since',
        boredomMultiplier: 1.2,
        hazardMultiplier: 1.3,
        openingLine: 'Head Gamemaker Livia Ash\'s first arena burned for nine days. The Capitol still sells prints of it.',
        signature: 'weather-front',
        signatureLine: 'Livia Ash sends her weather in glowing. Whatever it technically is, everyone watching calls it fire.',
    },
    {
        name: 'Marcus Quill',
        style: 'writes the commentary himself and shapes the Games to fit it',
        boredomMultiplier: 1.05,
        hazardMultiplier: 1.05,
        openingLine: 'Head Gamemaker Marcus Quill narrates his own Games in private, colleagues report, and edits the arena when the story sags.',
        signature: 'release-mutts',
        signatureLine: 'Marcus Quill decides the second act needs teeth, and sends them. The commentary desk receives his notes within the minute.',
    },
    {
        name: 'Cornelia Frost',
        style: 'is a former victor, and it makes the Capitol deeply uneasy',
        boredomMultiplier: 0.8,
        hazardMultiplier: 0.95,
        openingLine: 'Head Gamemaker Cornelia Frost won her own Games thirty years ago. Nobody in the control room mentions it twice.',
        signature: 'spare-the-young',
        signatureLine: 'A parachute falls to the youngest tribute breathing. Cornelia Frost signs the docket in her own name, legibly.',
    },
];

export function gamemakerProfile(name: string | undefined): HeadGamemakerProfile {
    return HEAD_GAMEMAKERS.find(g => g.name === name) ?? HEAD_GAMEMAKERS[0];
}
