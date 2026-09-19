import { GameState, Item } from '../models/types';
import { arenaHasLaw } from './gamesProfile';

/**
 * AUDIT-9 B03: one place that decides whether a thing may reach a tribute.
 *
 * The arena's laws were enforced wherever somebody remembered to enforce them,
 * which meant they were enforced on the paths that had been audited and
 * nowhere else. Reproduced: the Forgotten Carnival, whose whole identity is
 * that no weapon works inside it, accepted a sword sent by the player; the
 * Vault, which is a communications blackout and has a `noSponsors` guard in
 * the automatic sponsor stream twelve lines long, accepted a player parachute.
 * The player's booth was simply not on the list of things the law applied to.
 *
 * A law that applies to the simulation and not to the player is not a law, it
 * is a difficulty setting for the AI. So the question "may this item reach
 * this tribute, here, now" has one answer, and every route that can put an
 * object into somebody's hands asks it: the player's parachute, the automatic
 * sponsor stream, and anything scripted that follows them.
 *
 * Returns the reason for a refusal, or `undefined` when it may go. A reason
 * rather than a boolean on purpose — the audit's requirement is that a
 * rejected purchase is *visible*, and the caller cannot explain a bare false.
 */
export function giftRefusal(state: GameState, item: Item, zone?: string): string | undefined {
    // §5.1 `noSponsors`: nothing the Capitol wants to send can be got down to
    // the floor at all.
    if (arenaHasLaw(state, 'noSponsors')) {
        return `Nothing reaches the floor in ${state.arena.name}. No parachute has ever got through, and this one would not either.`;
    }
    // §5 `noWeapons`: the arena refuses steel, whoever is paying for it.
    if (arenaHasLaw(state, 'noWeapons') && item.type === 'weapon') {
        return `${state.arena.name} does not permit a weapon inside it. The Capitol will send anything else.`;
    }
    // `sponsorsFixedZone`: gifts only ever reach the one drop zone, so
    // sponsorship is a race to be standing in it.
    if (arenaHasLaw(state, 'sponsorsFixedZone')
        && state.arena.lawZone !== undefined
        && zone !== undefined
        && zone !== state.arena.lawZone) {
        return `Parachutes only come down over ${state.arena.lawZone} in this arena. They would have to be standing there.`;
    }
    return undefined;
}
