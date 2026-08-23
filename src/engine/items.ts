import { Item, ItemQuality, Tribute } from '../models/types';
import { INVENTORY, PHYSIQUE, QUALITY } from '../data/balance';
import { RNG } from '../utils/rng';
import { massOf } from './physique';
import { traitMod } from '../data/traits';

// Item names that read as plurals and so take "some", not "a"/"an".
const PLURAL_ITEM_IDS = new Set(['knife', 'berries', 'matches', 'bow']);

/**
 * Turns an item into a grammatical noun phrase for the chronicle feed.
 * Templates used to hardcode "a {item}", which produced "a Axe" and
 * "a Foraged Berries".
 */
export function itemPhrase(item: Item): string {
    const name = displayName(item);
    if (PLURAL_ITEM_IDS.has(item.id)) return `some ${name}`;
    return `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;
}

/** The name as it should read in the feed, including its grade. */
export function displayName(item: Item): string {
    const prefix = item.quality && item.quality !== 'standard' ? QUALITY.prefix[item.quality] : '';
    return prefix ? `${prefix} ${item.name}` : item.name;
}

/**
 * Mints a fresh instance of a base item.
 *
 * Every item that entered the world used to be a bare `{ ...ITEMS[n] }`, which
 * meant every Sword in every run was exactly the same Sword. An instance now
 * gets a grade rolled for it — scaling damage, durability and what the Capitol
 * thinks it is worth — and carries the durability it started with, so
 * condition can be read as a fraction rather than only noticed at zero.
 *
 * `bias` shifts the roll: the mouth of the Cornucopia and a sponsor parachute
 * deal in good equipment, scavenged and improvised gear does not.
 */
export function mintItem(rng: RNG, base: Item, bias: number = 0): Item {
    const item: Item = { ...base };
    if (item.quality === undefined && (item.type === 'weapon' || item.type === 'armour')) {
        const roll = rng.nextFloat() + bias;
        const quality: ItemQuality = roll > QUALITY.fineAbove ? 'fine'
            : roll < QUALITY.crudeBelow ? 'crude'
            : 'standard';
        item.quality = quality;
        const scale = QUALITY.scale[quality];
        if (item.damage !== undefined) item.damage = Math.max(1, Math.round(item.damage * scale));
        if (item.durability !== undefined) item.durability = Math.round(item.durability * scale);
        if (item.armour !== undefined) item.armour = Math.round(item.armour * scale * 100) / 100;
        item.value = Math.round(item.value * scale);
    }
    if (item.durability !== undefined) item.maxDurability = item.durability;
    return item;
}

/**
 * Condition, 0-1. A weapon used to be at full strength right up to the instant
 * it snapped; a blade three exchanges from breaking should already be a worse
 * blade than a fresh one.
 */
export function conditionOf(item: Item): number {
    if (item.durability === undefined) return 1;
    const max = item.maxDurability ?? item.durability;
    if (max <= 0) return 1;
    return Math.max(0, Math.min(1, item.durability / max));
}

/** Effective damage after condition. Never falls below a floor: a blunt sword is still a bar of steel. */
export function effectiveDamage(item: Item): number {
    const base = item.damage ?? 0;
    return base * (QUALITY.wornDamageFloor + (1 - QUALITY.wornDamageFloor) * conditionOf(item));
}

/**
 * Total damage reduction from whatever they are wearing, capped so a tribute
 * hung with three pieces of armour is still killable.
 */
export function armourOf(t: Tribute): number {
    const total = t.inventory.reduce((sum, i) =>
        sum + (i.armour ?? 0) * conditionOf(i), 0);
    return Math.min(QUALITY.maxArmour, total);
}

/** Wears down whatever took the hit. Armour absorbs damage by being damaged — spread across every worn piece, so three pieces wear out together rather than the first being destroyed while the rest stay pristine. */
export function wearArmour(t: Tribute, amount: number) {
    const worn = t.inventory.filter(i => i.armour !== undefined && (i.durability ?? 0) > 0);
    if (worn.length === 0) return;
    const share = amount / worn.length;
    worn.forEach(piece => {
        piece.durability = Math.max(0, (piece.durability ?? 0) - share);
    });
}

export function hasTool(t: Tribute, key: 'purifies' | 'light' | 'warmth' | 'fishing'): boolean {
    return t.inventory.some(i => i[key] === true);
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
    // A flat 4 for everyone meant a Frail twelve-year-old hauled exactly as much
    // out of the Cornucopia as a Muscular eighteen-year-old from District 2.
    // `build` was generated with care and read only by display code.
    const fromBuild = Math.round(massOf(t) * PHYSIQUE.capacityPerMass);
    // Containers carry their own capacity now, so a satchel is a smaller pack
    // rather than a second special case.
    const fromContainers = t.inventory.reduce((sum, i) => sum + (i.capacity ?? 0), 0);
    return Math.max(2, INVENTORY.baseCapacity + fromBuild + traitMod(t, 'capacity') + fromContainers);
}

/** Ranks what a tribute would rather drop first when their hands are full. */
function keepValue(t: Tribute, item: Item): number {
    // The thing you are carrying it all in is never the thing you throw away
    // to make room — and dropping it would shrink the room you just made.
    if (item.capacity !== undefined) return Infinity;
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
    // §10.1: 'Nothing but Hands' needs to know whether a weapon ever passed
    // through these hands — set once, here, where every acquisition funnels.
    if (items.some(i => i.type === 'weapon')) t.everCarriedWeapon = true;
    // Stackable consumables merge rather than each taking a slot — three loaves
    // of bread is one thing you are carrying, not three.
    items.forEach(item => {
        if (item.stack === undefined) { t.inventory.push(item); return; }
        const existing = t.inventory.find(i =>
            i.id === item.id && i.stack !== undefined && i.stack < INVENTORY.maxStack);
        if (existing) existing.stack = Math.min(INVENTORY.maxStack, (existing.stack ?? 1) + (item.stack ?? 1));
        else t.inventory.push(item);
    });
    return enforceCapacity(t);
}

/**
 * Drops whatever no longer fits, and returns it so the caller can narrate.
 *
 * Capacity is not constant: it depends on holding a Backpack, so a tribute who
 * loses the pack — dropped in a sanity breakdown, or taken off a body by
 * someone else — instantly has less room than they are using. `giveItem` only
 * enforces the limit at the moment something is added, so nothing noticed the
 * shrink and a tribute could walk around permanently over capacity.
 */
export function enforceCapacity(t: Tribute): Item[] {
    const dropped: Item[] = [];
    // Recomputed every pass: containers carry capacity of their own now, so
    // dropping the satchel to make room can shrink the room it made.
    while (t.inventory.length > carryCapacity(t)) {
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

/**
 * §3.3: how laden a tribute is, 0-1. Zero until the pack passes
 * `encumbranceFreeFraction` of capacity, rising to 1 at a full pack. Read by
 * combat power, concealment and the fatigue drain — being over-equipped
 * finally costs something at the moment it used to be pure advantage.
 */
export function encumbranceOf(t: Tribute): number {
    const load = t.inventory.length / Math.max(1, carryCapacity(t));
    const free = INVENTORY.encumbranceFreeFraction;
    return Math.max(0, Math.min(1, (load - free) / (1 - free)));
}

/** How many cycles of shelf life carried containers add to fresh food.
 *  §11.5: any capacity keeps food out of the sun — a satchel buys one cycle,
 *  the full Backpack still buys the most. */
export function spoilageBonus(t: Tribute): number {
    const capacity = t.inventory.reduce((sum, i) => sum + (i.capacity ?? 0), 0);
    if (capacity <= 0) return 0;
    return Math.min(INVENTORY.backpackSpoilageBonus, capacity);
}

/**
 * Takes one use out of a stack, removing the item only when the stack is empty.
 * Returns false if they did not have one.
 */
export function consumeOne(t: Tribute, predicate: (i: Item) => boolean): Item | undefined {
    const idx = t.inventory.findIndex(predicate);
    if (idx < 0) return undefined;
    const item = t.inventory[idx];
    if (item.stack !== undefined && item.stack > 1) {
        item.stack -= 1;
        return item;
    }
    return t.inventory.splice(idx, 1)[0];
}
