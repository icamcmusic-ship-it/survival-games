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

/**
 * §(requests 19): what the arena made of them, as pools rather than one line.
 *
 * Every earned trait had exactly one sentence, so the first kill in every run
 * in the game produced the same words — "wipes their hands on their trousers
 * and finds that they are steady" — regardless of whether the kill was a spear
 * thrown across a clearing, a drowning, a trap sprung two days earlier, or a
 * fight the killer very nearly lost. It was the most-repeated sentence in the
 * simulation and the one least likely to be true of the moment it described.
 *
 * `Bloodied` gets the widest set because it fires most often and covers the
 * widest range of first kills; the rest get enough not to repeat inside a run.
 * Drawn through `ctx.pickText`, so the same line does not come round twice.
 */
const EARNED_LINES: Record<string, string[]> = {
    'Bloodied': [
        '{name} has killed somebody now. They stand there a moment longer than they need to, and then they pick up their pack.',
        'It is done, and {name} finds that the doing of it took less time than deciding to.',
        '{name} does not look at the body again. Not once, all the way out of the clearing.',
        'The first one. {name} discovers that their hands are steady and cannot decide whether that is the good news.',
        '{name} says something under their breath that the microphones do not catch, and walks on.',
        'Somebody in the Capitol is already calling it a highlight. {name} is still standing where it happened, working out what to do with their face.',
        '{name} has crossed the line the whole country was waiting to see them cross, and the commentary does not shut up about it for an hour.',
        'Afterwards {name} is very calm and very careful, and does three small useful things in a row without needing to.',
        '{name} kills somebody for the first time and the arena carries on exactly as it was, which is the part nobody warns them about.',
        'There is no moment of it that {name} will be able to describe afterwards. There is only before and after.',
        '{name} checks their own hands, their own arms, their own ribs — all of it still theirs — and only then looks at what is on the ground.',
        'The cannon goes for somebody {name} killed. {name} flinches at it, which they will not do the next time.',
        '{name} is sick afterwards, out of shot, and comes back looking like somebody who has decided something.',
        'They will ask {name} about this one in the interview. {name} is already deciding what to say.',
    ],
    'Haunted': [
        '{name} has not slept since. They keep the treeline between themselves and everybody left.',
        '{name} wakes at every sound now, including the ones that are not there.',
        'Something has come loose in {name}. They are still moving, still careful, and no longer entirely in the same arena as everyone else.',
        '{name} has started talking to somebody who is not in {zone}, quietly, and stopping when they notice.',
        'The thing {name} saw is still in front of them, and it does not matter which way they face.',
    ],
    'Hardened': [
        '{name} came out of that alive, and something in how they carry themselves has changed. Whatever comes next, they have met worse.',
        '{name} has stopped reacting to things. Not bravely — the reaction simply does not arrive any more.',
        'Whatever that was, {name} walked out of it, and everybody who saw them do it adjusts their estimate.',
        '{name} takes stock in {zone} with the flat competence of somebody who has already survived the worst thing available.',
    ],
    'Merciful': [
        '{name} had them, and let them go. The Capitol will talk about nothing else tonight.',
        '{name} lowers the weapon. Nobody in the arena, the Capitol or the districts can explain why, including {name}.',
        'The shot was there and {name} did not take it, and everybody watching knows exactly what it will cost them.',
        '{name} decides, in {zone}, that they are not going to be the one who does it. The decision holds.',
    ],
    'Starved': [
        '{name} has stopped noticing that they are hungry. That is not the good news it sounds like, but it will keep them walking.',
        'Hunger has gone quiet in {name} the way a wound goes quiet. It is still there and it is still working.',
        '{name} eats something in {zone} without tasting it, without thinking about it, and without stopping.',
    ],
    'Venom-Wise': [
        '{name} survives the venom, and spends the whole of the next day looking very carefully at everything they touch.',
        '{name} comes out the far side of it knowing, now, what that plant does and how long it takes.',
        'Whatever was in {name} has burned itself out. They will recognise it instantly next time, and they will be right.',
    ],
    'Marked': [
        '{name} will not be caught like that twice. They will also, most likely, never take anyone\'s hand again.',
        '{name} has learnt what an offer is worth in here, and the lesson took.',
        'Something in how {name} stands near other people has changed, and it will not change back.',
    ],
    'Feared': [
        'The name has gone round the arena. Nobody wants to be the one who finds {name} first.',
        '{name} has become a direction the rest of the field walks away from.',
        'The commentary has stopped describing what {name} does and started describing what people do about {name}.',
    ],
    'Firetouched': [
        '{name} walks out of the fire with their eyebrows singed off and their hands steady. They do not flinch at the smell of smoke any more.',
        '{name} has been burned badly enough to stop being frightened of it, which is its own kind of dangerous.',
        'The fire had {name} and did not keep them. {name} knows exactly how close that was and walks towards the next one anyway.',
    ],
    'Trapwise': [
        '{name} crouches over the sprung mechanism for a long moment, learning it. The arena\'s little machines have stopped being mysteries.',
        '{name} can read the ground now. The tells are small and they are always there and {name} has started seeing them.',
        'Somebody built that, and {name} has worked out how. That knowledge does not go away.',
    ],
    'Waterborn': [
        '{name} comes ashore without gasping this time. The water has stopped arguing with them.',
        '{name} has learnt what the water in here does, and moves through it like somebody who grew up with it.',
        'The crossing that nearly took {name} on day one is a walk now.',
    ],
    'Silent Step': [
        'Nobody has laid eyes on {name} in days. The commentators have started calling them a ghost, and they are not wrong about how it moves.',
        '{name} has worked out where the noise comes from and stopped making it.',
        'The cameras keep losing {name} in {zone}. So does everybody else.',
    ],
    'Oathbound': [
        '{name} kept the agreement to its last hour, and everyone watching knows it. In this arena, that is the rarest thing anyone owns.',
        '{name} had every reason to break it and did not, and that is now a fact about {name} the whole field has to price in.',
        'The terms held because {name} held them. Nothing enforced it but {name}.',
    ],
    'Vulture': [
        '{name} works through the fallen tribute\'s pack with a practicality that unsettles even the Capitol. Waste, they seem to feel, is for people with sponsors.',
        '{name} has got quick at this. Boots first, then the pack, then anything sharp, and gone inside a minute.',
        'There is no ceremony left in it for {name}. There is a body, and there are supplies, and the supplies are the part that matters.',
    ],
    'Witness': [
        '{name} has now watched it happen twice. Something in how they look at the people they eat with has closed.',
        '{name} saw the whole of it, again, and has stopped assuming that an agreement is a thing that holds.',
        'Twice now {name} has been standing close enough to see somebody decide. They will not forget what that looks like.',
    ],
    'Frostbitten': [
        '{name} loses feeling in the same fingers for the second time, and this time does not panic about it. The cold has become a fact rather than an event.',
        'The cold has had {name} twice now. They have learnt what it takes and what it leaves.',
        '{name} checks their hands in {zone} with the weary competence of somebody who has already lost something to this.',
    ],
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

    // A conversion narrates itself. `transformTrait` (traitArcs.ts) hands the
    // arc its own line and logs it immediately after this call returns, so
    // narrating here as well printed the beat twice — and because none of the
    // three conversion targets (Broken, Ruthless, Treacherous) has an entry in
    // `EARNED_LINES`, the first of the two was the bare fallback below, with a
    // bracketed trait id in it. Measured over 120 runs before this change: 120
    // log lines shipped to the player ending in `[Broken]`, `[Hollow]`,
    // `[Ruthless]` or `[Treacherous]`.
    if (converted) return true;

    const pool = EARNED_LINES[trait];
    const line = pool
        ? ctx.pickText(pool).split('{name}').join(t.name).split('{zone}').join(t.zone)
        : `${t.name} is not the same person who came off the plate. [${trait}]`;
    ctx.logEvent(line, [t.id], { important: true, category: 'sanity' });
    return true;
}
