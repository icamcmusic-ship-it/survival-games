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

/**
 * §6: names built out of where this happened and what it was done with.
 *
 * The arena supplies the adjective and the weapon supplies the noun, which is
 * how real weapon names work — a thing is named for the place it became
 * notorious or for what it does. Deterministic given the same inputs; the
 * caller picks between the candidates with the seeded text picker.
 */
function composeName(ctx: SimContext, weapon: Item, wielder: Tribute): string[] {
    // The arena's own vocabulary: the distinctive word out of its name, and
    // the distinctive word out of the zone the kill happened in.
    const significant = (phrase: string): string | undefined =>
        phrase
            .replace(/\(.*?\)/g, ' ')
            .split(/[^A-Za-z]+/)
            .filter(w => w.length > 3 && !STOP_WORDS.has(w.toLowerCase()))
            .sort((a, b) => b.length - a.length)[0];

    const arenaWord = significant(ctx.state.arena.name);
    const zoneWord = significant(wielder.zone);
    // The weapon's own noun, minus any quality adjective it arrived with.
    const weaponNoun = weapon.name.split(' ').slice(-1)[0];

    const out: string[] = [];
    const cap = (w: string) => w[0].toUpperCase() + w.slice(1).toLowerCase();
    if (zoneWord) out.push(`the ${cap(zoneWord)}-${cap(weaponNoun)}`);
    if (arenaWord) out.push(`the ${cap(arenaWord)}-${cap(weaponNoun)}`);
    if (zoneWord) out.push(`the ${cap(weaponNoun)} of ${wielder.zone}`);
    if (arenaWord) out.push(`${cap(arenaWord)}'s Answer`);
    out.push(`District ${wielder.district}'s ${cap(weaponNoun)}`);
    return out;
}

/** Words that carry no arena identity and make a poor half of a name. */
const STOP_WORDS = new Set([
    'the', 'and', 'of', 'from', 'into', 'over', 'under', 'arena', 'games',
    'cornucopia', 'sector', 'zone', 'field', 'area', 'place', 'this', 'that',
    'with', 'their', 'there', 'here',
]);

/** Records a kill against the weapon that took it, and names it if it is due. */
export function bloodOnTheBlade(ctx: SimContext, weapon: Item | undefined, wielder: Tribute) {
    if (!weapon || weapon.type !== 'weapon') return;
    weapon.bloodDrawn = (weapon.bloodDrawn ?? 0) + 1;
    if (weapon.legendName || weapon.bloodDrawn < LEGENDARY_ITEMS.killsToEarnAName) return;

    // A name already in circulation this run is not available: two weapons
    // called Second Chance is one weapon called Second Chance and a mistake.
    const taken = new Set(ctx.state.tributes.flatMap(t => t.inventory.map(i => i.legendName).filter(Boolean)));

    // §6: a name out of this arena and this weapon, not out of a flat list of
    // twenty. A blade that has killed twice in a reef is the Reef-Blade; the
    // fixed pool is the fallback for when the composed name is already taken
    // or the arena's own vocabulary produces nothing usable.
    const composed = composeName(ctx, weapon, wielder).filter(n => !taken.has(n));
    const available = LEGENDARY_ITEM_NAMES.filter(n => !taken.has(n));
    const pool = composed.length > 0 ? composed : available;
    if (pool.length === 0) return;

    weapon.legendName = ctx.pickText(pool);
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
