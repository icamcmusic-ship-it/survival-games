import type { ArenaEventDef } from '../arenaFlavor';
import { EXTRA_ARENA_EVENTS_GROUP1 } from './group1';
import { EXTRA_ARENA_EVENTS_GROUP2 } from './group2';
import { EXTRA_ARENA_EVENTS_GROUP3 } from './group3';
import { EXTRA_ARENA_EVENTS_GROUP4 } from './group4';
import { EXTRA_ARENA_EVENTS_GROUP5 } from './group5';
import { EXTRA_ARENA_EVENTS_GROUP6 } from './group6';
import { EXTRA_ARENA_EVENTS_GROUP7 } from './group7';
// AUDIT-13 §9.2/§10.2: arena deaths D33–D76 and events V33–V76.
import { EXTRA_ARENA_EVENTS_GROUP8 } from './group8';
import { EXTRA_ARENA_EVENTS_GROUP9 } from './group9';
// AUDIT-14 §6: arena deaths A1–A42 and events V31–V72.
import { EXTRA_ARENA_EVENTS_GROUP10 } from './group10';

export { UNIVERSAL_EVENTS_GROUP6, AUDIT11_CAUSES } from './group6';
export { UNIVERSAL_EVENTS_GROUP7, AUDIT12_CAUSES } from './group7';

/** Every extra authored event, keyed by arena id. */
export const EXTRA_ARENA_EVENTS: Record<string, ArenaEventDef[]> = {};
for (const group of [EXTRA_ARENA_EVENTS_GROUP1, EXTRA_ARENA_EVENTS_GROUP2, EXTRA_ARENA_EVENTS_GROUP3, EXTRA_ARENA_EVENTS_GROUP4, EXTRA_ARENA_EVENTS_GROUP5, EXTRA_ARENA_EVENTS_GROUP6, EXTRA_ARENA_EVENTS_GROUP7, EXTRA_ARENA_EVENTS_GROUP8, EXTRA_ARENA_EVENTS_GROUP9, EXTRA_ARENA_EVENTS_GROUP10]) {
    for (const [id, events] of Object.entries(group)) {
        EXTRA_ARENA_EVENTS[id] = [...(EXTRA_ARENA_EVENTS[id] ?? []), ...events];
    }
}
