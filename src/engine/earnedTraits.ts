import { Tribute } from '../models/types';
import { SimContext } from './context';
import { TRAIT_DEFS } from '../data/traits';
import { traitFits } from '../data/constants';

/**
 * Traits a tribute leaves the arena with that they did not arrive with.
 *
 * A reaped trait list is a fixed character sheet: whoever a tribute was on day
 * 0 is exactly who they are when they win. Earned traits are the cheapest
 * narrative arc available — the first kill, the ally who died in front of them,
 * the mutt they survived, the person they chose not to finish. Each one is a
 * real mechanical change (they are rows in the same table as everything else),
 * and each one is a line in the chronicle at the moment the person changes.
 *
 * Deliberately one-way and deliberately rare: a tribute picks up at most a
 * handful in a run, and never one that contradicts who they already are.
 */

const EARNED_LINES: Record<string, (t: Tribute) => string> = {
    'Bloodied': t => `${t.name} wipes their hands on their trousers and finds that they are steady. Whoever walked onto that plate, it was not this person.`,
    'Haunted': t => `${t.name} has not slept since. They keep the treeline between themselves and everybody left.`,
    'Hardened': t => `${t.name} came out of that alive, and something in how they carry themselves has changed. Whatever comes next, they have met worse.`,
    'Merciful': t => `${t.name} had them, and let them go. The Capitol will talk about nothing else tonight.`,
    'Starved': t => `${t.name} has stopped noticing that they are hungry. That is not the good news it sounds like, but it will keep them walking.`,
    'Venom-Wise': t => `${t.name} survives the venom, and spends the whole of the next day looking very carefully at everything they touch.`,
    'Marked': t => `${t.name} will not be caught like that twice. They will also, most likely, never take anyone's hand again.`,
    'Feared': t => `The name has gone round the arena. Nobody wants to be the one who finds ${t.name} first.`,
    'Firetouched': t => `${t.name} walks out of the fire with their eyebrows singed off and their hands steady. They do not flinch at the smell of smoke any more.`,
    'Trapwise': t => `${t.name} crouches over the sprung mechanism for a long moment, learning it. The arena's little machines have stopped being mysteries.`,
    'Waterborn': t => `${t.name} comes ashore without gasping this time. The water has stopped arguing with them.`,
    'Silent Step': t => `Nobody has laid eyes on ${t.name} in days. The commentators have started calling them a ghost, and they are not wrong about how it moves.`,
    'Oathbound': t => `${t.name} kept the agreement to its last hour, and everyone watching knows it. In this arena, that is the rarest thing anyone owns.`,
    'Vulture': t => `${t.name} works through the fallen tribute's pack with a practicality that unsettles even the Capitol. Waste, they seem to feel, is for people with sponsors.`,
};

/**
 * Grants an earned trait if this tribute can carry it. Returns true if it
 * actually landed, so callers can avoid double-narrating.
 *
 * §3.4: `converted` exists for `traitArcs.ts` and nothing else.
 *
 * The `earned` flag answers "may an ambient path in the arena hand this trait
 * out?", and for a reaping trait like Ruthless or Treacherous the answer is
 * no — you do not spontaneously become treacherous, you are dealt it. But a
 * *conversion* is not an ambient grant: the arc has already established that
 * this specific person has done a specific thing enough times that the trait
 * they were carrying is no longer true of them. Gating that on `earned` meant
 * Merciful -> Ruthless and Loyal -> Treacherous rolled back silently every
 * cycle they were eligible — 25,821 site-cycles across 120 runs, zero
 * conversions — because neither target is an earnable trait.
 *
 * Everything else still applies: they must be alive, and `traitFits` still has
 * the final say, so a conversion cannot produce a contradictory sheet either.
 */
export function earnTrait(ctx: SimContext, t: Tribute, trait: string, converted = false): boolean {
    if (t.status !== 'alive') return false;
    if (!converted && !TRAIT_DEFS[trait]?.earned) return false;
    if (!TRAIT_DEFS[trait]) return false;
    if (!traitFits(t.traits, trait)) return false;

    t.traits.push(trait);
    const line = EARNED_LINES[trait];
    ctx.logEvent(
        line ? line(t) : `${t.name} is not the same person who came off the plate. [${trait}]`,
        [t.id],
        { important: true, category: 'sanity' }
    );
    return true;
}
