import { RNG } from '../utils/rng';
import { Tribute } from '../models/types';
import { legacyOf } from './districts';

/**
 * §8.3: tribute backstories beyond `reapingNote`.
 *
 * The reaping note says how they came to be on the plate; nothing said who
 * was standing there. Twenty-four people arrived with a district number, a
 * stat block and no life — which is why two tributes with the same archetype
 * read as the same person.
 *
 * A backstory is composed once, at generation, from three parts that are all
 * grounded in facts the generator has already decided: a family shape, work
 * that follows the district's actual industry, and one formative detail that
 * agrees with their traits or their tesserae count. Composed rather than
 * drawn whole so the pool sizes multiply — 10 x ~3 x ~8 is thousands of
 * distinct lives from three short tables.
 */

const FAMILY = [
    'the eldest of four, and the one the others were sent to find at dusk',
    'an only child, raised mostly by a grandmother with strong opinions',
    'the middle one of five, used to being overlooked and good at using it',
    'a twin — the quiet one, everyone always said, as if that settled anything',
    'raised by an older sister after the accident nobody in the family names',
    'the youngest by nine years, half-raised by the whole street',
    'one of two kids in a house where nobody wasted words or food',
    'raised above the family workshop, asleep to the sound of the trade',
    'the one who stayed home when the others went to work, until they were old enough to go too',
    'from a house with more people than beds and a door that never locked',
];

/** What a childhood in each district's industry actually consists of. */
const WORK: Record<number, string[]> = {
    1: ['polishing settings in the finishing shop since age nine', 'running finished pieces between workshops, learning what everything costs', 'apprenticed to an engraver with no patience and steady hands'],
    2: ['hauling cut stone up from the quarry benches', 'sorting blast rubble for the seam of good granite', 'sharpening tools for the masons since they could hold a file'],
    3: ['soldering boards on the night line', 'stripping salvaged machines for parts worth keeping', 'running diagnostics scripts they understood better than the supervisor did'],
    4: ['mending nets on the sea wall before school', 'crewing a cousin\'s boat in the summer runs', 'diving the shallows for shellfish on the low tides'],
    5: ['reading dials in the turbine hall on the shift nobody wants', 'climbing pylons with a grease rag and no harness', 'rewinding motors in the repair shed'],
    6: ['coupling freight cars in the marshalling yard', 'riding the maintenance trolley through the tunnels', 'keeping the depot\'s log because they were the one who could be trusted with it'],
    7: ['limbing felled trunks ahead of the saw crews', 'setting choker cables on the steep cuts', 'stacking cordwood until their shoulders stopped complaining'],
    8: ['threading looms before their hands got too big for it', 'running bolts of cloth to the dye vats', 'picking seams for rework, twelve hours at a stretch'],
    9: ['walking the grain rows with a hook and a sack', 'loading elevators at harvest until midnight', 'keeping birds off the drying floors'],
    10: ['droving stock to the rail pens', 'mucking yards before dawn and after school', 'holding animals steady for the brand and learning not to flinch'],
    11: ['picking orchards on the tall ladders', 'walking the irrigation lines at first light', 'sorting fruit at the packing sheds, fastest hands on the bench'],
    12: ['picking over the slag heaps for saleable coal', 'hauling water to the pithead crews', 'setting snares in the woods past the fence, which nobody official ever saw'],
};

/**
 * The formative detail. Each entry carries an optional gate so the detail
 * agrees with the person it lands on — the generator tries a handful of draws
 * and keeps the first whose gate passes, falling back to the ungated pool.
 */
interface Detail {
    text: string;
    fits?: (t: Tribute) => boolean;
}

const DETAILS: Detail[] = [
    { text: 'They have been feeding their family on tessera grain for years, and everyone in the square knew it.', fits: t => (t.tesserae ?? 0) >= 3 },
    { text: 'They have never once been hungry, and the arena is about to explain what that cost them.', fits: t => t.isCareer },
    { text: 'They watched a sibling get reaped once. The name in their head at the reaping was not their own.', fits: t => !t.isCareer },
    { text: 'They can carry more than grown men twice their size, and stopped being surprised by it years ago.', fits: t => t.attributes.strength >= 8 },
    { text: 'Teachers used to move them to the back because they finished everything first.', fits: t => t.attributes.intelligence >= 8 },
    { text: 'Half their district knows them by name, and the other half knows them by sight.', fits: t => t.attributes.charisma >= 8 },
    { text: 'Nobody ever hears them coming. It used to be a game. It stopped being a game.', fits: t => t.attributes.stealth >= 8 },
    { text: 'They lost somebody to the Games already. They do not talk about which year.' },
    { text: 'They have a reputation for winning arguments they should have lost.' },
    { text: 'They keep their promises with a literalness that has cost them friends.' },
    { text: 'They taught themselves to read weather, and are rarely wrong about tomorrow.' },
    { text: 'They have broken the same arm twice and consider it bad luck rather than a lesson.' },
    { text: 'There is somebody back home they did not say goodbye to properly, and it is the only thing they regret so far.' },
    { text: 'They are the one neighbours fetch when something has to be done calmly.' },
];

/** One composed life, stable per tribute because the RNG stream is seeded. */
export function composeBackstory(rng: RNG, t: Tribute): string {
    const family = rng.pick(FAMILY);
    const work = rng.pick(WORK[t.district] ?? WORK[12]);
    // A few draws to find a detail that fits; the ungated entries guarantee
    // termination without a filter pass that would change draw counts by
    // tribute (which would ripple the shared RNG stream).
    let detail = rng.pick(DETAILS);
    for (let i = 0; i < 4 && detail.fits && !detail.fits(t); i++) detail = rng.pick(DETAILS);
    const detailText = detail.fits && !detail.fits(t)
        ? 'They are harder to sum up than the Capitol\'s one-line bios prefer.'
        : detail.text;

    const legacy = legacyOf(t.district);
    return `${t.name} is ${family}, ${work} in the ${legacy.industry.toLowerCase()} trade. ${detailText}`;
}
