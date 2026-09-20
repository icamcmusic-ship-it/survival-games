import { Item, Tribute } from '../models/types';
import { SimContext } from './context';
import { LEGENDARY_ITEM_NAMES, LEGENDARY_ITEM_TEXTS } from '../data/flavorText';
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
    // Audit 4 §1.4: `${word}'s Answer` shipped "Swamps's Answer" and
    // "Fields's Answer" to the feed, the chronicle and the record book,
    // because a good half of the arena names are plural nouns.
    const possessive = (w: string) => (/s$/i.test(w) ? `${w}'` : `${w}'s`);
    if (zoneWord) out.push(`the ${cap(zoneWord)}-${cap(weaponNoun)}`);
    if (arenaWord) out.push(`the ${cap(arenaWord)}-${cap(weaponNoun)}`);
    if (zoneWord) out.push(`the ${cap(weaponNoun)} of ${wielder.zone}`);
    if (arenaWord) out.push(`${possessive(cap(arenaWord))} Answer`);
    out.push(`${possessive(`District ${wielder.district}`)} ${cap(weaponNoun)}`);
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
    // twenty. A blade that has killed twice in a reef is the Reef-Blade.
    //
    // Audit 4 §1.3: the fixed pool used to be the *fallback* for an empty
    // composed list — and `composeName` ends with an unconditional push, so
    // the composed list is never empty. Measured over 180 runs: 86 distinct
    // legendary names, not one of them from the sixteen authored ones. The
    // two sets are now one candidate list, so a blade is sometimes The
    // Argument and sometimes the Reef-Blade, which is the mix the feature
    // wanted in the first place.
    //
    // The authored list is sampled down to the size of the composed list
    // rather than concatenated whole: sixteen against five would have flipped
    // the imbalance the other way and made the arena-derived names — the
    // better half of the feature — the rare ones.
    const composed = composeName(ctx, weapon, wielder).filter(n => !taken.has(n));
    const available = LEGENDARY_ITEM_NAMES.filter(n => !taken.has(n));
    const authored = ctx.rng.shuffle(available).slice(0, Math.max(1, composed.length));
    const pool = [...composed, ...authored];
    if (pool.length === 0) return;

    weapon.legendName = ctx.pickText(pool);
    /*
     * AUDIT-9 batch 4: who named it.
     *
     * `it-changed-hands` promises "a named weapon held by somebody other than
     * the tribute who named it" and had no way to check that — its predicate
     * asked whether *some* dead tribute anywhere had a kill, which is nearly
     * always true, so it unlocked on exactly the same runs as
     * `a-weapon-with-a-name` across the whole 500-run sample. Differently
     * worded, same question, which is the B03 defect a second time.
     *
     * The weapon has to carry its origin for the card to be able to ask.
     */
    weapon.legendNamedById = wielder.id;
    // Audit 5 §1.4: the twelve authored naming lines were never drawn — this
    // moment fires twice a run in nine runs out of ten and printed one
    // hard-coded sentence every time.
    const line = ctx.pickText(LEGENDARY_ITEM_TEXTS)
        .split('{item}').join(weapon.legendName)
        .split('{base}').join(weapon.name.toLowerCase())
        .split('{owner}').join(wielder.name);
    ctx.logEvent(line, [wielder.id], { important: true, category: 'system' });
}

/** Every named weapon in the arena right now, with whoever is carrying it. */
export function namedWeapons(tributes: Tribute[]): Array<{ item: Item; owner: Tribute }> {
    return tributes.flatMap(owner =>
        owner.inventory.filter(i => i.legendName).map(item => ({ item, owner })));
}
