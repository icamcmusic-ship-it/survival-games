import { Tribute } from '../models/types';
import { SimContext, getAlive } from './context';
import { EARNED_TRAIT_RULES } from '../data/balance';
import { TRAIT_DEFS } from '../data/traits';
import { earnTrait } from './earnedTraits';
import { resolveOf } from './resolve';

/**
 * §3.2: traits that change.
 *
 * `earnedTraits.ts` grants traits mid-run and is the best arc machinery in the
 * codebase — but it is strictly additive. A tribute could carry Pacifist and
 * Bloodied at the same time, having sworn they would not do this and then done
 * it three times, and the sheet showed both with no comment. Nothing was ever
 * lost, so nothing was ever really a stage: a trait was a badge, not a phase.
 *
 * This is the other direction. Three shapes, one pass, run once a cycle:
 *
 *   decay      the run disproves a trait and it burns off — Softhearted after
 *              a third kill, Skittish once they have stopped being frightened;
 *   conflict   two traits that cannot both be true collapse into a third —
 *              Pacifist + Bloodied resolve into Broken rather than coexisting;
 *   evolution  a chain walked down as the same thing keeps happening —
 *              Skittish -> Haunted -> Hollow.
 *
 * Deliberately narrow. Every rule below is a specific pair of traits with a
 * specific line attached, because the whole value of the mechanic is that the
 * moment somebody changes is legible in the feed. A generic decay timer over
 * the whole table would produce churn, not arc.
 */

/** Cycles this tribute has carried a trait, tolerating pre-§3.2 saves. */
function ageOf(t: Tribute, trait: string): number {
    return t.traitAge?.[trait] ?? 0;
}

/**
 * Removes a trait, records it as shed and narrates the loss. Shedding is a
 * beat: nobody notices a trait arriving as much as they notice one going.
 */
export function shedTrait(ctx: SimContext, t: Tribute, trait: string, line: string) {
    const index = t.traits.indexOf(trait);
    if (index < 0) return;
    t.traits.splice(index, 1);
    t.shedTraits = [...(t.shedTraits ?? []), trait];
    if (t.traitAge) delete t.traitAge[trait];
    ctx.logEvent(line, [t.id], { important: true, category: 'sanity' });
}

/**
 * Replaces one trait with another, in one beat. Used by both the conflict and
 * the evolution rules — the predecessor is removed first so `traitFits` inside
 * `earnTrait` sees a list the successor can actually join.
 */
function transformTrait(ctx: SimContext, t: Tribute, from: string[], to: string, line: string): boolean {
    if (!TRAIT_DEFS[to] || t.traits.includes(to)) return false;
    const held = from.filter(trait => t.traits.includes(trait));
    if (held.length !== from.length) return false;
    held.forEach(trait => {
        const index = t.traits.indexOf(trait);
        if (index >= 0) t.traits.splice(index, 1);
        t.shedTraits = [...(t.shedTraits ?? []), trait];
        if (t.traitAge) delete t.traitAge[trait];
    });
    if (!earnTrait(ctx, t, to)) {
        // The successor could not land (an incompatibility the table knows
        // about that this rule does not). Put the tribute back the way they
        // were rather than leaving them with neither.
        held.forEach(trait => t.traits.push(trait));
        t.shedTraits = (t.shedTraits ?? []).filter(trait => !held.includes(trait));
        return false;
    }
    ctx.logEvent(line, [t.id], { important: true, category: 'sanity' });
    return true;
}

/** One tribute's arc, one cycle. */
function tickOne(ctx: SimContext, t: Tribute) {
    // Age every trait they are carrying, so the rules below can ask how long
    // somebody has been this way rather than only whether they are.
    t.traitAge = t.traitAge ?? {};
    t.traits.forEach(trait => {
        t.traitAge![trait] = (t.traitAge![trait] ?? 0) + 1;
    });

    // --- conflict -------------------------------------------------------
    // The one that matters most. Someone who swore they would not do this and
    // has now done it is not a pacifist with an asterisk; they are a person
    // whose account of themselves has failed. That is Broken, and it is worse
    // for them than either trait was.
    if (transformTrait(ctx, t, ['Pacifist', 'Bloodied'], 'Broken',
        `${t.name} said, on Caesar's couch, that they would not do this. The Capitol has the tape. Something in how they hold themselves has given up arguing with it.`)) {
        return;
    }

    // --- evolution ------------------------------------------------------
    // Skittish -> Haunted is handled by the grief path in `relationships.ts`
    // (which grants Haunted); what this adds is the far end of the chain. A
    // tribute who has been Haunted for days, with their sanity gone, stops
    // being frightened — which reads as calm and is not.
    if (t.traits.includes('Haunted')
        && ageOf(t, 'Haunted') >= EARNED_TRAIT_RULES.hollowCycles
        && t.vitals.sanity <= EARNED_TRAIT_RULES.hollowSanity) {
        if (transformTrait(ctx, t, ['Haunted'], 'Hollow',
            `${t.name} has stopped flinching at the cannons. They watch the sky the way somebody watches weather in a country they no longer live in.`)) {
            return;
        }
    }

    // --- decay ----------------------------------------------------------
    // Softhearted after the third kill. The trait's own info string says they
    // "cannot finish it"; three bodies is the arena disproving that out loud.
    if (t.traits.includes('Softhearted') && t.kills >= EARNED_TRAIT_RULES.softheartedShedKills) {
        shedTrait(ctx, t, 'Softhearted',
            `${t.name} does not sit with this one the way they sat with the first. Whatever it was in them that could not finish it has been used up.`);
    }

    // Skittish, burned off the other way: a tribute who has held their nerve
    // for days is no longer the person who jumped at branches on day one.
    if (t.traits.includes('Skittish')
        && ageOf(t, 'Skittish') >= EARNED_TRAIT_RULES.skittishShedCycles
        && resolveOf(t) >= EARNED_TRAIT_RULES.skittishShedResolve) {
        shedTrait(ctx, t, 'Skittish',
            `${t.name} hears something in the treeline and turns toward it instead of away. They have been out here long enough to stop being startled by the arena.`);
    }
}

/** One pass over the field. Call once per cycle, after the fighting. */
export function tickTraitArcs(ctx: SimContext) {
    getAlive(ctx.state).forEach(t => tickOne(ctx, t));
}
