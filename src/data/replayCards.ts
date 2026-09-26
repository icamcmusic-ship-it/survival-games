/**
 * AUDIT-13 P1/P4: the cards a player picks at setup that travel in the config
 * — scenario cards and commentator voices. Data only, so the save migrations
 * and share-link parser can validate an id without importing the engine.
 */
export interface ScenarioCard {
    id: string;
    name: string;
    blurb: string;
    /** The card's own achievement id. */
    achievement: string;
}

export const SCENARIO_CARDS: ScenarioCard[] = [
    {
        id: 'career-six', name: 'The Pack of Six', achievement: 'a13-scenario-pack-beaten',
        blurb: 'All six tributes of Districts 1, 2 and 4 are volunteers who walk in already trusting each other.',
    },
    {
        id: 'lone-volunteer', name: 'The Lone Volunteer', achievement: 'a13-scenario-lone-volunteer',
        blurb: 'Nobody volunteers this year except one tribute from the furthest district in the Games.',
    },
    {
        id: 'rival-allies', name: 'Strange Allies', achievement: 'a13-scenario-strange-allies',
        blurb: 'Two tributes from the two districts furthest apart walk in as sworn allies.',
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
];
