import { Item } from '../models/types';

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
