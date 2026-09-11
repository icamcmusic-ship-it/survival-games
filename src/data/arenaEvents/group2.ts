import type { ArenaEventDef } from '../arenaFlavor';

/**
 * §7.4: once-per-run, chained, reactive and signature-death events, authored
 * per arena and merged into `ARENA_FLAVOR[id].events` at load. Split across
 * files by arena group so the packs can be written independently of the
 * 14,000-line flavour table.
 */
export const EXTRA_ARENA_EVENTS_GROUP2: Record<string, ArenaEventDef[]> = {};
