import { Item, Tribute } from '../models/types';
import { SimContext } from './context';
import { ABANDONED_CAMPS } from '../data/balance';
import { ITEMS, IMPROVISED_ITEMS } from '../data/constants';
import { giveItem, mintItem } from './items';
import { QUALITY_BIAS } from '../data/balance';
import { cycleOf, noteSighting } from './memory';

/**
 * §5.5: a camp somebody left in a hurry.
 *
 * A zone a tribute fled used to reset to its ambient state the instant they
 * were out of it: the fire they had going, the shelter they spent three cycles
 * building and the pack they dropped running all simply stopped existing.
 * The arena had no memory of anybody having been anywhere, which is a strange
 * gap in a game that already models zone traffic, tracks and depletion.
 *
 * An abandoned camp is the trace they did not have time to pick up. It is
 * discoverable through the same machinery that already reads how busy a zone
 * has been, it carries real salvage, and finding one tells you something about
 * a living person and where they were going — which is worth more than the
 * salvage.
 */

/*
 * AUDIT-9 B04: where each tribute was standing at the end of last cycle.
 *
 * Kept so a departure can be noticed without threading a hook through the six
 * places that assign `t.zone` (multi-cycle crossings, group moves, border
 * collapse and the ordinary wander all write it, and only some of them know
 * why). That reasoning is still right; the *storage* was not.
 *
 * This was a module-level `WeakMap`, which is process memory rather than run
 * state, so it did not survive a save. Reproduced: after a cloned save
 * resumed, the same flee transition created no abandoned camp and left the old
 * camp standing, where uninterrupted play created one and removed the old
 * camp. Two players with the same seed got different arenas depending on
 * whether one of them had reloaded — which is the same class of defect as the
 * intervention-RNG divergence, one subsystem over.
 *
 * It lives on the tribute now, so it serialises with everything else.
 */

/**
 * Per-cycle: notice who left a camp behind, then let anybody standing in a
 * cold one find it. Called after movement has resolved, alongside the trap
 * check — it is the same "what is already here" pass, for the same reason.
 */
export function tickAbandonedCamps(ctx: SimContext) {
    ctx.state.tributes.forEach(t => {
        if (t.status !== 'alive') return;
        const was = t.lastZone;
        // Left somewhere they were dug into, while trying to get out of it.
        if (was !== undefined && was !== t.zone && t.objective?.kind === 'flee' && t.objective.from === was) {
            abandonCamp(ctx, t, was);
        }
        t.lastZone = t.zone;
    });
    ctx.state.tributes.forEach(t => {
        if (t.status === 'alive') checkAbandonedCamps(ctx, t);
    });
}

/** Someone leaving a zone they had made camp in, faster than they meant to. */
export function abandonCamp(ctx: SimContext, t: Tribute, zone: string) {
    const state = ctx.state;
    const camp = state.camps?.[t.id];
    const cycle = cycleOf(state);
    // Only a real camp leaves a trace. Passing through leaves tracks, and
    // tracks are the memory system's job, not this one's.
    const settled = camp && (camp.fire !== undefined || camp.shelter !== undefined);
    if (!settled) return;

    state.abandonedCamps = state.abandonedCamps ?? [];
    // One trace per zone: a zone somebody has fled twice is not two caches.
    if (state.abandonedCamps.some(c => c.zone === zone && c.foundBy === undefined)) return;

    // What gets left is what a person running does not stop for.
    const droppable = t.inventory.filter(i => i.type !== 'weapon');
    const left: string[] = [];
    if (droppable.length > 0 && ctx.rng.chance(ABANDONED_CAMPS.dropCarriedChance)) {
        const dropped = ctx.rng.pick(droppable);
        t.inventory = t.inventory.filter(i => i !== dropped);
        left.push(dropped.id);
    }
    // Plus whatever the camp itself was made of.
    if (ctx.rng.chance(ABANDONED_CAMPS.campSalvageChance)) left.push(ctx.rng.pick([...ABANDONED_CAMPS.salvage]));

    state.abandonedCamps.push({ zone, ownerId: t.id, ownerName: t.name, cycle, items: left });
    // Their own camp is gone; they cannot walk back into a shelter they left
    // three zones ago.
    if (state.camps) delete state.camps[t.id];
}

/**
 * Somebody walking into a zone where a camp was left. Called once per cycle
 * after movement, alongside the trap check — the same "what is already here"
 * pass, for the same reason.
 */
function checkAbandonedCamps(ctx: SimContext, t: Tribute) {
    const state = ctx.state;
    const camp = (state.abandonedCamps ?? []).find(c =>
        c.zone === t.zone && c.foundBy === undefined && c.ownerId !== t.id);
    if (!camp) return;
    const age = cycleOf(state) - camp.cycle;
    if (age > ABANDONED_CAMPS.lifetimeCycles) return;
    /*
     * §16: whether they came here for this, or tripped over it.
     *
     * `updateObjective` runs earlier in the same cycle than this pass, and
     * nothing clears a spent intention until the next one — so a tribute who
     * has just arrived on a `scavenge` is still holding it here, naming this
     * zone and this owner. That is the difference between a search and a
     * coincidence, and it decides both the roll and the line.
     */
    const onPurpose = t.objective?.kind === 'scavenge'
        && t.objective.zone === t.zone && t.objective.ownerId === camp.ownerId;
    // A cold camp is not hidden, exactly — it is just easy to walk past.
    // Unless you crossed the arena to stand on it, in which case you are not
    // walking past anything.
    if (!onPurpose
        && !ctx.rng.chance(ABANDONED_CAMPS.findBase + t.attributes.intelligence * ABANDONED_CAMPS.findPerIntelligence)) return;

    camp.foundBy = t.id;
    camp.items.forEach(id => {
        const def = ITEMS.find(i => i.id === id) ?? IMPROVISED_ITEMS.find(i => i.id === id);
        if (def) giveItem(t, mintItem(ctx.rng, def as Item, QUALITY_BIAS.scavenged));
    });

    // The real prize: somebody was here, recently, and left in a hurry.
    const owner = state.tributes.find(o => o.id === camp.ownerId);
    if (owner && owner.status === 'alive') {
        noteSighting(state, t, owner.zone, 1, 0);
    }
    const haul = camp.items.length > 0 ? 'things nobody walks away from on purpose' : 'nothing worth taking';
    ctx.logEvent(
        onPurpose
            ? `${t.name} walked to ${t.zone} for ${camp.ownerName}'s kit, and it is still there: a cold fire, `
              + `a windbreak still half up, and ${haul}. They did not have to look twice.`
            : `${t.name} finds a camp in ${t.zone} that somebody left standing: a cold fire, a windbreak still half up, `
              + `and ${haul}. `
              + `Whoever it was, they left ${age <= 1 ? 'within the hour' : 'a couple of days ago'}, and they left fast.`,
        [t.id],
        { important: true, zone: t.zone, category: 'loot' }
    );
}
