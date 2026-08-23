/**
 * PERF: the single lazy boundary between the app shell and the simulation.
 *
 * Everything the store needs to *start* or *run* a Games lives behind this
 * module, which is only ever reached through `import('./engineBundle')`. That
 * keeps the engine and its big data tables (`data/arenaFlavor`, `data/balance`,
 * `data/flavorText`, …) out of the initial chunk — nothing in here is needed
 * until a run actually begins.
 *
 * It is a pure re-export: no behaviour, and in particular nothing that touches
 * the RNG, so the seeded-replay guarantee is untouched by the split.
 */
export { Simulator } from './simulator';
export { generateTributes } from './generator';
export { generateArena } from './arenaGenerator';
export { configForProfile, gamesProfileFor } from './gamesProfile';
export { sendPlayerParachute, sponsorCost, sponsorableItems } from './playerSponsor';
export { tributeOdds } from './odds';
