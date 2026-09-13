import type { ArenaEventDef } from '../arenaFlavor';
import { EXTRA_ARENA_EVENTS_GROUP1 } from './group1';
import { EXTRA_ARENA_EVENTS_GROUP2 } from './group2';
import { EXTRA_ARENA_EVENTS_GROUP3 } from './group3';
import { EXTRA_ARENA_EVENTS_GROUP4 } from './group4';

/** Every extra authored event, keyed by arena id. */
export const EXTRA_ARENA_EVENTS: Record<string, ArenaEventDef[]> = {};
for (const group of [EXTRA_ARENA_EVENTS_GROUP1, EXTRA_ARENA_EVENTS_GROUP2, EXTRA_ARENA_EVENTS_GROUP3, EXTRA_ARENA_EVENTS_GROUP4]) {
    for (const [id, events] of Object.entries(group)) {
        EXTRA_ARENA_EVENTS[id] = [...(EXTRA_ARENA_EVENTS[id] ?? []), ...events];
    }
}
