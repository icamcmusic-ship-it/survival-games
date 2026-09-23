import { craftOf } from '../data/districts';
import { ITEM_AFFINITY } from '../data/balance';
import { GameState, Item, ItemQuality, Tribute } from '../models/types';
import { arenaHasLaw } from './gamesProfile';
import { INVENTORY, ITEM_CONDITION, PHYSIQUE, QUALITY, SITUATIONAL_KIT } from '../data/balance';
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

/**
 * §10.2: how worn a thing is, as a band rather than a float.
 *
 * `conditionOf` has always returned a fraction, and combat has always read it.
 * Nothing ever *said* it: a sword one exchange from snapping was named exactly
 * like the one taken off the horn an hour ago, so the entire durability
 * system was invisible until the moment something broke.
 */
export type ItemCondition = 'pristine' | 'serviceable' | 'worn' | 'failing';

export function conditionTier(item: Item): ItemCondition {
    if (item.durability === undefined) return 'pristine';
    const c = conditionOf(item);
    if (c >= ITEM_CONDITION.pristineAbove) return 'pristine';
    if (c >= ITEM_CONDITION.serviceableAbove) return 'serviceable';
    if (c >= ITEM_CONDITION.failingBelow) return 'worn';
    return 'failing';
}

/** The name as it should read in the feed, including its grade and its condition. */
export function displayName(item: Item): string {
    const prefix = item.quality && item.quality !== 'standard' ? QUALITY.prefix[item.quality] : '';
    const named = prefix ? `${prefix} ${item.name}` : item.name;
    // Only the bad news gets said. "A serviceable axe" is just an axe.
    const tier = conditionTier(item);
    if (tier === 'worn') return `${named}, ${ITEM_CONDITION.wornSuffix}`;
    if (tier === 'failing') return `${named}, ${ITEM_CONDITION.failingSuffix}`;
    return named;
}

/**
 * §10.2: strip a piece you are leaving behind for the one you are keeping.
 *
 * Two of the same kind of thing in a pack that only holds so much used to mean
 * one of them going on the ground intact. Returns true if anything was
 * actually recovered, so the caller can say so.
 */
export function salvageInto(keeper: Item, scrap: Item): boolean {
    if (keeper.durability === undefined || scrap.durability === undefined) return false;
    if (keeper.type !== scrap.type) return false;
    if (scrap.durability < ITEM_CONDITION.salvageFloor) return false;
    const max = keeper.maxDurability ?? keeper.durability;
    const ceiling = max * ITEM_CONDITION.salvageCeiling;
    if (keeper.durability >= ceiling) return false;
    const recovered = Math.min(
        scrap.durability * ITEM_CONDITION.salvageYield,
        ceiling - keeper.durability,
    );
    if (recovered <= 0) return false;
    keeper.durability = Math.round((keeper.durability + recovered) * 100) / 100;
    scrap.durability = 0;
    return true;
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

/**
 * §5 `noWeapons`: the arena's own item pool. Every site that mints or drops
 * something reads this rather than `ITEMS` directly, so an arena that declares
 * the law simply has no blades in it — the horn, the feast table, a parachute
 * and a forage roll all come up empty of them.
 */
export function itemPoolFor(state: GameState, pool: Item[]): Item[] {
    if (!arenaHasLaw(state, 'noWeapons')) return pool;
    const stripped = pool.filter(i => i.type !== 'weapon');
    return stripped.length > 0 ? stripped : pool.filter(i => i.type === 'food' || i.type === 'water');
}

export function hasTool(t: Tribute, key: 'purifies' | 'light' | 'warmth' | 'fishing'): boolean {
    return t.inventory.some(i => i[key] === true);
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
    // A §10: what the *arena* makes worth keeping. `keepValue` has no context
    // of its own, so the cycle pass stamps the climate's priorities onto the
    // tribute and this reads them: a cloak is dead weight in a jungle and the
    // difference between living and not in the Frozen Wasteland.
    const priorities = t.kitPriorities;
    if (priorities?.warmth) {
        if (item.warmth === true) value += SITUATIONAL_KIT.coldWarmthBonus;
        if (item.id === 'matches' || item.id === 'flint') value += SITUATIONAL_KIT.coldFireBonus;
    }
    if (priorities?.water && item.type === 'water') value += SITUATIONAL_KIT.dryWaterBonus;
    if (priorities?.purifier && item.purifies === true) value += SITUATIONAL_KIT.foulWaterPurifierBonus;
    // §10.2: how worn it is, in bands, rather than a single cliff at 10
    // durability that read the same for a fine sword and a crude one.
    const tier = conditionTier(item);
    if (tier === 'worn') value -= ITEM_CONDITION.wornKeepPenalty;
    if (tier === 'failing') value -= ITEM_CONDITION.failingKeepPenalty;
    return value;
}

/**
 * Gives a tribute an item, dropping whatever they value least if their hands
 * are full. Returns the items left behind so the caller can narrate it.
 */
/*
 * AUDIT-10 B14: two loaves are only one thing you are carrying when they are
 * the same thing.
 *
 * The merge used to key on item id alone, and a stack carries exactly one set
 * of properties — so day-old bread absorbed into a fresh loaf came out fresh.
 * One bread at spoilage 1 plus one bread at spoilage 9 became two bread at
 * spoilage 1, and reversing the order of arrival reversed the answer: food that
 * should have been about to turn had its life silently extended, or the
 * reverse. That is a live food-safety mechanic, not a bookkeeping nicety.
 *
 * So: merge only where the properties a stack cannot represent separately
 * actually agree. Anything else opens its own stack and keeps its own history,
 * which is what a batch is.
 */
function mergeable(existing: Item, incoming: Item): boolean {
    if (existing.id !== incoming.id) return false;
    // Spoilage is the one that bites. Round to a band rather than demanding
    // exact equality, so a bag of food does not shatter into a stack per hour
    // while still never laundering a nearly-spoiled batch into a fresh one.
    const band = (i: Item) => Math.floor((i.spoilage ?? 0) / INVENTORY.stackSpoilageBand);
    if (band(existing) !== band(incoming)) return false;
    if ((existing.quality ?? undefined) !== (incoming.quality ?? undefined)) return false;
    if ((existing.poison ?? false) !== (incoming.poison ?? false)) return false;
    if ((existing.durability ?? undefined) !== (incoming.durability ?? undefined)) return false;
    // A weapon that has drawn blood is a specific object and never a unit.
    if ((existing.bloodDrawn ?? 0) !== 0 || (incoming.bloodDrawn ?? 0) !== 0) return false;
    return true;
}


export function giveItem(t: Tribute, ...items: Item[]): Item[] {
    // §10.1: 'Nothing but Hands' needs to know whether a weapon ever passed
    // through these hands — set once, here, where every acquisition funnels.
    if (items.some(i => i.type === 'weapon')) t.everCarriedWeapon = true;
    /*
     * Stackable consumables merge rather than each taking a slot — three loaves
     * of bread is one thing you are carrying, not three.
     *
     * AUDIT-9 B08: and the overflow goes somewhere.
     *
     * The merge used to be `min(maxStack, existing + incoming)`, which silently
     * destroyed whatever did not fit: adding three bread to a stack of three
     * against a maximum of four left four and returned no dropped items, so six
     * units became four and nothing anywhere recorded the loss. That is a
     * conservation hole in the one function every acquisition in the game
     * funnels through — sponsor gifts, feast packs, looting, trades, debt
     * repayment and the shared cache all land here.
     *
     * Now: fill every partial stack of the same item first, then open new
     * stacks for the remainder, and let `enforceCapacity` rule on the result.
     * Anything that genuinely does not fit is *dropped*, which is returned to
     * the caller and narrated, rather than deleted.
     */
    items.forEach(item => {
        if (item.stack === undefined) { t.inventory.push(item); return; }
        let remaining = item.stack;
        // Top up existing partial stacks — but only ones this batch can
        // honestly merge into. See `mergeable`.
        for (const existing of t.inventory) {
            if (remaining <= 0) break;
            if (existing.stack === undefined || !mergeable(existing, item)) continue;
            const room = INVENTORY.maxStack - existing.stack;
            if (room <= 0) continue;
            const moved = Math.min(room, remaining);
            existing.stack += moved;
            // Within a band, the merged stack ages to the older of the two:
            // merging never makes food fresher than the freshest thing in it.
            if (existing.spoilage !== undefined || item.spoilage !== undefined) {
                existing.spoilage = Math.max(existing.spoilage ?? 0, item.spoilage ?? 0);
            }
            remaining -= moved;
        }
        // The object itself goes in where nothing was merged into, so identity
        // — quality, condition, contamination, provenance — survives the
        // common case exactly as it did before.
        if (remaining === item.stack) {
            item.stack = Math.min(INVENTORY.maxStack, remaining);
            remaining -= item.stack;
            t.inventory.push(item);
        }
        // Anything still left opens further stacks, carrying the same
        // properties as the thing it was split off.
        while (remaining > 0) {
            const take = Math.min(INVENTORY.maxStack, remaining);
            t.inventory.push({ ...item, stack: take });
            remaining -= take;
        }
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
        const [leaving] = t.inventory.splice(worstIdx, 1);
        // §10.2: before it hits the ground, it gets stripped for the one being
        // kept. The obvious thing to do with a second axe you have no room
        // for, and the only route a worn weapon has back short of a sponsor.
        const keeper = t.inventory
            .filter(i => i.type === leaving.type && i.durability !== undefined)
            // The neediest piece, not the best one — a repair is worth most
            // where there is most to repair.
            .sort((a, b) => conditionOf(a) - conditionOf(b))[0];
        if (keeper) salvageInto(keeper, leaving);
        dropped.push(leaving);
    }
    return dropped;
}

/**
 * §3.3: how laden a tribute is, 0-1. Zero until the pack passes
 * `encumbranceFreeFraction` of capacity, rising to 1 at a full pack. Read by
 * combat power, concealment and the fatigue drain — being over-equipped
 * finally costs something at the moment it used to be pure advantage.
 */
/**
 * Total worth of everything a tribute is carrying.
 *
 * A1: read by the Scavenging precondition — "has nothing worth having" is a
 * situation, and it needs a number.
 */
export function inventoryValue(t: Tribute): number {
    return t.inventory.reduce((sum, i) => sum + i.value * (i.stack ?? 1), 0);
}

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
/**
 * Take one unit out of the pack and return it.
 *
 * **The returned object is not always detached.** On a stack of more than one
 * this decrements and returns the object that is *still in `t.inventory`* —
 * which is right for consuming (eat one ration, the rest stay) and wrong for
 * anything that hands the result to somebody else. Giving that object to
 * another tribute puts one object in two inventories, where it degrades and
 * spoils in lockstep for both of them, and nothing in a chronicle would ever
 * show it.
 *
 * A caller that means to *transfer* must either require `stack === 1` or split
 * a fresh single-unit object off. `engine/triage` does the former, having done
 * the latter wrong first.
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

/**
 * §(requests): what a tribute reaches for.
 *
 * District craft decided how *well* somebody fought with a weapon and nothing
 * decided what they picked up, so the trident was a District 4 statistic
 * rather than a District 4 identity: the girl from 4 came up from the horn
 * holding a mace as often as anybody else, fought worse with it than she would
 * have with the trident, and the broadcast never got the shot it exists for.
 *
 * This biases a draw toward the tribute's own trade without guaranteeing it.
 * The signature weapon is weighted hardest, the rest of the district's
 * affinity list next, its weapon classes after that — so a District 7 tribute
 * usually finds an axe, sometimes finds a billhook, and occasionally finds
 * whatever was actually lying there, which is what makes the usual case worth
 * watching. Nothing here creates an item that is not already in the pool: an
 * arena that has no tridents in it does not grow one for District 4.
 */
export function pickForDistrict(rng: RNG, t: Tribute, pool: Item[]): Item {
    if (pool.length === 0) throw new Error('pickForDistrict: empty pool');
    const craft = craftOf(t.district);
    const weight = (i: Item) => {
        if (i.id === craft.signatureWeapon) return ITEM_AFFINITY.signatureWeight;
        if (craft.affinityItems.includes(i.id)) return ITEM_AFFINITY.affinityWeight;
        if (i.weaponClass !== undefined && craft.affinityClasses.includes(i.weaponClass)) {
            return ITEM_AFFINITY.classWeight;
        }
        return 1;
    };
    let roll = rng.nextFloat() * pool.reduce((sum, i) => sum + weight(i), 0);
    for (const item of pool) {
        roll -= weight(item);
        if (roll <= 0) return item;
    }
    return pool[pool.length - 1];
}
