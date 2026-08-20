import { Item, Tribute } from '../models/types';
import { INVENTORY } from '../data/balance';

// Item names that read as plurals and so take "some", not "a"/"an".
const PLURAL_ITEM_IDS = new Set(['knife', 'berries', 'matches', 'bow']);

/**
 * Turns an item into a grammatical noun phrase for the chronicle feed.
 * Templates used to hardcode "a {item}", which produced "a Axe" and
 * "a Foraged Berries".
 */
export function itemPhrase(item: Item): string {
    if (PLURAL_ITEM_IDS.has(item.id)) return `some ${item.name}`;
    return `${/^[aeiou]/i.test(item.name) ? 'an' : 'a'} ${item.name}`;
}

export function hasBackpack(t: Tribute): boolean {
    return t.inventory.some(i => i.id === 'backpack');
}

/**
 * How much a tribute can carry.
 *
 * The Backpack used to be the one utility item in the loot table with no
 * implemented effect at all — rope crafts a spear, wire crafts a garrote,
 * matches keep the cold off, and the Backpack was decorative. A carry limit
 * gives it a job and makes stripping a body a decision rather than a freebie.
 */
export function carryCapacity(t: Tribute): number {
    return INVENTORY.baseCapacity + (hasBackpack(t) ? INVENTORY.backpackCapacity : 0);
}

/** Ranks what a tribute would rather drop first when their hands are full. */
function keepValue(t: Tribute, item: Item): number {
    // The pack itself is never the thing you throw away to make room.
    if (item.id === 'backpack') return Infinity;
    let value = item.value;
    // A weapon you are actually carrying is worth more than its price tag.
    if (item.type === 'weapon') value += (item.damage ?? 0) * 6;
    if (item.type === 'medical') value += 20;
    if (item.type === 'water' && t.vitals.thirst > 40) value += 40;
    if (item.type === 'food' && t.vitals.hunger > 40) value += 40;
    // A broken weapon is dead weight.
    if (item.durability !== undefined && item.durability <= 10) value -= 30;
    return value;
}

/**
 * Gives a tribute an item, dropping whatever they value least if their hands
 * are full. Returns the items left behind so the caller can narrate it.
 */
export function giveItem(t: Tribute, ...items: Item[]): Item[] {
    t.inventory.push(...items);
    const capacity = carryCapacity(t);
    const dropped: Item[] = [];
    while (t.inventory.length > capacity) {
        let worstIdx = 0;
        let worstValue = Infinity;
        t.inventory.forEach((item, idx) => {
            const value = keepValue(t, item);
            if (value < worstValue) { worstValue = value; worstIdx = idx; }
        });
        dropped.push(...t.inventory.splice(worstIdx, 1));
    }
    return dropped;
}

/** How many cycles of shelf life a Backpack adds to fresh food. */
export function spoilageBonus(t: Tribute): number {
    return hasBackpack(t) ? INVENTORY.backpackSpoilageBonus : 0;
}
