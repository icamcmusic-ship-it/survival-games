import { EventLog, GameState } from '../models/types';

/**
 * AUDIT-12 §14: the facts the new achievements need that neither the final
 * state nor a (trimmable) chronicle can be trusted to hold.
 *
 * Called once per logged line from `context.ts`, which every beat in the
 * engine already passes through, so no other file needs a hook. Everything it
 * writes is small and bounded, and it never touches the RNG or any mechanical
 * state — it only watches.
 */
const SCARRING_EFFECTS = new Set(['burning', 'flooded']);

export function noteLogFacts(state: GameState, entry: EventLog): void {
    const facts = state.audit12Facts ?? (state.audit12Facts = {});
    const ids = entry.tributesInvolved ?? [];

    // Downed, and (because the victor is alive at the end) recovered.
    if (entry.category === 'injury' && ids.length > 0 && /does not get up\. No cannon\./.test(entry.text)) {
        const downed = facts.downed ?? (facts.downed = {});
        downed[ids[0]] = (downed[ids[0]] ?? 0) + 1;
    }

    if (entry.type === 'weather-fronts') facts.fronts = (facts.fronts ?? 0) + 1;

    // An abandoned camp taken over (engine/abandonedCamps.ts).
    if (entry.category === 'loot' && ids.length > 0 && entry.zone
        && /a cold fire, a windbreak still half up/.test(entry.text)) {
        const camps = facts.campsFound ?? (facts.campsFound = {});
        const zones = camps[ids[0]] ?? (camps[ids[0]] = []);
        if (!zones.includes(entry.zone)) zones.push(entry.zone);
    }

    if (entry.type === 'ambush' && entry.zone && facts.campsFound) {
        ids.filter(id => id !== entry.actorId).forEach(id => {
            if (facts.campsFound?.[id]?.includes(entry.zone!)) {
                const hit = facts.ambushedAtCamp ?? (facts.ambushedAtCamp = []);
                if (!hit.includes(id)) hit.push(id);
            }
        });
    }

    // Standing on ground the same day it caught fire, flooded or fell in.
    const scarDay = facts.scarDay ?? (facts.scarDay = {});
    // A structure falling in, as `arenaDepth` scars it — not the border
    // closing a sector, which happens to most zones in most runs.
    const scars = state.arenaDepth?.scars ?? {};
    const scarredNow = (zone: string) => scars[zone]?.kind === 'collapsed'
        || (state.zoneEffects?.[zone] ?? []).some(e => SCARRING_EFFECTS.has(e.kind));
    for (const zone of Object.keys(scarDay)) if (!scarredNow(zone)) delete scarDay[zone];
    for (const zone of [...Object.keys(state.zoneEffects ?? {}), ...Object.keys(scars)]) {
        if (scarDay[zone] === undefined && scarredNow(zone)) scarDay[zone] = state.day;
    }
    const scarred = facts.scarredGround ?? (facts.scarredGround = []);
    for (const t of state.tributes) {
        if (t.status !== 'alive' || scarred.includes(t.id)) continue;
        if (scarDay[t.zone] === state.day) scarred.push(t.id);
    }
}
