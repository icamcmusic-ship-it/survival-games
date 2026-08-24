import { Item, Tribute } from '../models/types';
import { SimContext } from './context';
import { LEGENDARY_ITEM_NAMES } from '../data/flavorText';
import { LEGENDARY_ITEMS } from '../data/balance';

/**
 * §11.6: a weapon that earns a name.
 *
 * Every weapon in the game generates as a category instance — the only thing
 * telling two swords apart is `ItemQuality` — so no object in the arena ever
 * accumulated a history. A blade that has drawn blood more than once has one,
 * and the audience names it whether the tribute holding it does or not.
 *
 * Deliberately outside the mundane generation path in `items.ts`: these names
 * are never rolled at the horn, never parachuted, and never appear on a
 * weapon that has not killed. They are earned in a hand and they travel with
 * the object, which is the whole point — a weapon taken off a body keeps the
 * name it had when the body was holding it.
 */

/** Records a kill against the weapon that took it, and names it if it is due. */
export function bloodOnTheBlade(ctx: SimContext, weapon: Item | undefined, wielder: Tribute) {
    if (!weapon || weapon.type !== 'weapon') return;
    weapon.bloodDrawn = (weapon.bloodDrawn ?? 0) + 1;
    if (weapon.legendName || weapon.bloodDrawn < LEGENDARY_ITEMS.killsToEarnAName) return;

    // A name already in circulation this run is not available: two weapons
    // called Second Chance is one weapon called Second Chance and a mistake.
    const taken = new Set(ctx.state.tributes.flatMap(t => t.inventory.map(i => i.legendName).filter(Boolean)));
    const available = LEGENDARY_ITEM_NAMES.filter(n => !taken.has(n));
    if (available.length === 0) return;

    weapon.legendName = ctx.pickText(available);
    ctx.logEvent(
        `The commentary has stopped calling the ${weapon.name.toLowerCase()} in ${wielder.name}'s hand a ${weapon.name.toLowerCase()}. `
        + `As of tonight it is ${weapon.legendName}, and it will be ${weapon.legendName} in the record books whoever is holding it at the end.`,
        [wielder.id],
        { important: true, category: 'system' }
    );
}

/** Every named weapon in the arena right now, with whoever is carrying it. */
export function namedWeapons(tributes: Tribute[]): Array<{ item: Item; owner: Tribute }> {
    return tributes.flatMap(owner =>
        owner.inventory.filter(i => i.legendName).map(item => ({ item, owner })));
}
