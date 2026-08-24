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

/**
 * Where each tribute was standing at the end of last cycle, so a departure can
 * be noticed without threading a hook through the six places that assign
 * `t.zone` (multi-cycle crossings, group moves, border collapse and the
 * ordinary wander all write it, and only some of them know why).
 */
const LAST_ZONE = new WeakMap<Tribute, string>();

/**
 * Per-cycle: notice who left a camp behind, then let anybody standing in a
 * cold one find it. Called after movement has resolved, alongside the trap
 * check — it is the same "what is already here" pass, for the same reason.
 */
export function tickAbandonedCamps(ctx: SimContext) {
    ctx.state.tributes.forEach(t => {
        if (t.status !== 'alive') return;
        const was = LAST_ZONE.get(t);
        // Left somewhere they were dug into, while trying to get out of it.
        if (was !== undefined && was !== t.zone && t.objective?.kind === 'flee' && t.objective.from === was) {
            abandonCamp(ctx, t, was);
        }
        LAST_ZONE.set(t, t.zone);
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
    // A cold camp is not hidden, exactly — it is just easy to walk past.
    if (!ctx.rng.chance(ABANDONED_CAMPS.findBase + t.attributes.intelligence * ABANDONED_CAMPS.findPerIntelligence)) return;

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
    ctx.logEvent(
        `${t.name} finds a camp in ${t.zone} that somebody left standing: a cold fire, a windbreak still half up, `
        + `and ${camp.items.length > 0 ? 'things nobody walks away from on purpose' : 'nothing worth taking'}. `
        + `Whoever it was, they left ${age <= 1 ? 'within the hour' : 'a couple of days ago'}, and they left fast.`,
        [t.id],
        { important: true, zone: t.zone, category: 'loot' }
    );
}
