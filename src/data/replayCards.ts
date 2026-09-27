/**
 * AUDIT-13 P1/P4: the cards a player picks at setup that travel in the config
 * — scenario cards and commentator voices. Data only, so the save migrations
 * and share-link parser can validate an id without importing the engine.
 */
export interface ScenarioCard {
    id: string;
    name: string;
    blurb: string;
    /** The card's own achievement id, when it has one (AUDIT-14 F3 cards do not yet). */
    achievement?: string;
    /** AUDIT-14 S9: the fewest districts the card makes sense with; setup disables it below this. */
    minDistricts?: number;
}

export const SCENARIO_CARDS: ScenarioCard[] = [
    {
        id: 'career-six', name: 'The Pack of Six', achievement: 'a13-scenario-pack-beaten', minDistricts: 4,
        blurb: 'All six tributes of Districts 1, 2 and 4 are volunteers who walk in already trusting each other.',
    },
    {
        id: 'lone-volunteer', name: 'The Lone Volunteer', achievement: 'a13-scenario-lone-volunteer',
        blurb: 'Nobody volunteers this year except one tribute from the furthest district in the Games.',
    },
    {
        id: 'rival-allies', name: 'Strange Allies', achievement: 'a13-scenario-strange-allies',
        blurb: 'Two tributes from districts far apart walk in with a pact sworn, and come off the plates as allies.',
    },
    // AUDIT-14 F3: more cards, so a scenario player has not seen them all by
    // their fourth run. Each is applied at the reaping, with no RNG draws.
    {
        id: 'twins', name: 'The Twins',
        blurb: 'The pair from the first outer district grew up in the same house, and nothing the arena does will make them forget it.',
    },
    {
        id: 'career-defector', name: 'The Defector',
        blurb: 'One academy tribute has walked out on the pack before the train leaves, and the pack remembers.',
    },
    {
        id: 'mentors-favourite', name: 'The Mentor\'s Favourite',
        blurb: 'The furthest district\'s mentor has spent a year calling in favours for one tribute. The sponsors have already been told the name.',
    },
    {
        id: 'blind-draw', name: 'The Blind Draw',
        blurb: 'No volunteers at all this year. Every Career district sends whoever the bowl gave them.',
    },
    {
        id: 'old-grudge', name: 'The Old Grudge',
        blurb: 'Two tributes from neighbouring districts arrive already hating each other, over something that happened long before the reaping.',
    },
    {
        id: 'youngest-reaped', name: 'The Youngest',
        blurb: 'The youngest tribute in the field has been told they will not come home, and has decided to make a liar of everybody.',
    },
    {
        id: 'the-favourite', name: 'The Favourite',
        blurb: 'The Capitol has picked its winner before the parade: the oldest Career, whose face is already on the posters.',
    },
    {
        id: 'district-feud', name: 'Neighbours at War',
        blurb: 'The two tributes of one district cannot stand each other, and the whole of Panem saw it at the reaping.',
    },
    {
        id: 'the-outsiders', name: 'The Outsiders',
        blurb: 'The Careers are cold to everyone this year, and the outer districts walk in knowing it.',
    },
    {
        id: 'second-chance', name: 'The Second Chance',
        blurb: 'The tribute from the district that has gone longest without a crown carries the whole district\'s hope, and knows it.',
    },
    {
        id: 'packless', name: 'No Pack',
        blurb: 'The academies have fallen out. The Career tributes walk in as strangers to each other.',
    },
    {
        id: 'the-understudy', name: 'The Understudy',
        blurb: 'One tribute was reaped in place of a sibling, and the whole district watches them with a debt it cannot pay.',
    },
];

export function scenarioCard(id: string | undefined): ScenarioCard | undefined {
    return id ? SCENARIO_CARDS.find(c => c.id === id) : undefined;
}

/** AUDIT-13 P4: the recap voices. 'classic' is the default wording. */
export const COMMENTATORS = [
    { id: 'classic', name: 'The broadcast', blurb: 'The Capitol feed as it has always sounded.' },
    { id: 'showman', name: 'The showman', blurb: 'All teeth and applause: every death is a moment, every moment is television.' },
    { id: 'archivist', name: 'The archivist', blurb: 'Dry, exact and slightly tired. Counts everything and admires nothing.' },
    { id: 'rebel', name: 'The pirate feed', blurb: 'The districts\' illegal signal, and it does not pretend any of this is sport.' },
    // AUDIT-14 F3: three more voices.
    { id: 'bookmaker', name: 'The bookmaker', blurb: 'Prices, form and the spread. Every cannon moves a line somewhere.' },
    { id: 'historian', name: 'The historian', blurb: 'Every Games is compared with one that came before it, usually unfavourably.' },
    { id: 'poet', name: 'The poet', blurb: 'The late-night feed. Slow, strange, and fond of the arena in a way nobody else is.' },
] as const;

export const COMMENTATOR_IDS: string[] = COMMENTATORS.map(c => c.id);

/**
 * AUDIT-13 S1: the arena story chains' ids and titles, in the order
 * `engine/season/storyChains.ts` defines them (its rotation hashes into this
 * order, and `check-replayability` asserts the two agree). Kept here so the
 * setup chip and the record book can name a chain without the engine.
 */
export const STORY_CHAIN_META: ReadonlyArray<{ id: string; title: string }> = [
    { id: 'the-signal', title: 'The Signal' },
    { id: 'the-dead-tree', title: 'The Dead Tree' },
    { id: 'the-flood-gate', title: 'The Flood Gate' },
    { id: 'the-cache-map', title: 'The Cache Map' },
    { id: 'the-burn-line', title: 'The Burn Line' },
    { id: 'the-bell-tower', title: 'The Bell Tower' },
    { id: 'the-white-flag', title: 'The White Flag' },
    { id: 'the-frozen-pool', title: 'The Frozen Pool' },
    { id: 'the-sealed-door', title: 'The Sealed Door' },
    { id: 'the-drowned-bell', title: 'The Drowned Bell' },
    { id: 'the-false-spring', title: 'The False Spring' },
    { id: 'the-quiet-zone', title: 'The Quiet Zone' },
    { id: 'the-supply-drop', title: 'The Supply Drop' },
    { id: 'the-tally-stones', title: 'The Tally Stones' },
    { id: 'the-poisoned-well', title: 'The Poisoned Well' },
];
