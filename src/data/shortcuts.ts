/**
 * The keyboard map, as data.
 *
 * AUDIT-8 §2.1, open since AUDIT-7 §2.4. `GameScreen` bound twenty keys
 * directly off `e.key` in one long `else if` chain, with the help overlay
 * listing them in a second hand-maintained array beside it. Two consequences,
 * and the second is the one that matters:
 *
 *  1. The two lists could drift, and had: the first-run hint strip advertised
 *     two keys that did something else entirely, which AUDIT-7 §2.5 found and
 *     fixed by editing the strip rather than by removing the duplication.
 *  2. **Nothing could be rebound.** That is a real accessibility gap rather
 *     than a nicety: `[` and `]` need a modifier on most non-US layouts, `?`
 *     needs Shift on all of them, and a single-handed player cannot reach
 *     Space and Shift+D together. The help overlay taught the map, which made
 *     it discoverable and still unchangeable.
 *
 * So the bindings live here, the screen resolves a keypress through them, the
 * help overlay renders *from* them, and `Prefs.shortcutOverrides` lets a
 * player change any of them. One list, three readers.
 *
 * Deliberately not in `data/balance.ts`: these are not tunables, and
 * `check-balance-knobs` would be right to complain about a table of key
 * names sitting in it.
 */

/** Every rebindable command. The digits and Escape are deliberately not here. */
export type ShortcutId =
    | 'advance' | 'playPause'
    | 'chronicle' | 'map' | 'standings'
    | 'openWatched' | 'filterWatched'
    | 'nextDeath' | 'cycleTribute' | 'cycleZone'
    | 'filters' | 'prevDay' | 'nextDay' | 'density'
    | 'resetFilters' | 'help';

export interface ShortcutDef {
    id: ShortcutId;
    /** The key as `KeyboardEvent.key` reports it, lowercased for letters. */
    defaultKey: string;
    /** Shown in the help overlay and the remapping UI. */
    label: string;
    /** True when Shift+key does the same thing backwards. */
    reversible?: boolean;
}

/**
 * Order is display order in the help overlay and in Settings, so it reads as
 * "what you do most" rather than as an alphabet.
 */
export const SHORTCUTS: ShortcutDef[] = [
    { id: 'advance', defaultKey: ' ', label: 'Advance one phase' },
    { id: 'playPause', defaultKey: 'p', label: 'Start or stop auto-advance' },
    { id: 'chronicle', defaultKey: 'c', label: 'Show the chronicle' },
    { id: 'map', defaultKey: 'm', label: 'Switch between the chronicle and the arena map' },
    { id: 'standings', defaultKey: 's', label: 'Show the standings table' },
    { id: 'openWatched', defaultKey: 'o', label: 'Open the dossier of the tribute you are watching' },
    { id: 'filterWatched', defaultKey: 'x', label: 'Filter the chronicle to that same tribute, and back' },
    { id: 'nextDeath', defaultKey: 'd', label: 'Jump to the next death in the chronicle', reversible: true },
    { id: 'cycleTribute', defaultKey: 't', label: 'Cycle the tribute filter — past the last one clears it', reversible: true },
    { id: 'cycleZone', defaultKey: 'z', label: 'Cycle the sector filter — past the last one clears it', reversible: true },
    { id: 'filters', defaultKey: 'f', label: 'Show or hide the chronicle filters' },
    { id: 'prevDay', defaultKey: '[', label: 'Jump the chronicle to the previous day' },
    { id: 'nextDay', defaultKey: ']', label: 'Jump the chronicle to the next day' },
    { id: 'density', defaultKey: 'i', label: 'Cycle reading density — everything, scenes, headlines' },
    { id: 'resetFilters', defaultKey: '0', label: 'Reset every chronicle filter' },
    { id: 'help', defaultKey: '?', label: 'Open the help panel' },
];

/** How a key reads on screen. `' '` is a key and is not a printable label. */
export function keyLabel(key: string): string {
    if (key === ' ') return 'Space';
    if (key.length === 1) return key.toUpperCase();
    return key;
}

/**
 * The live binding for one command: the player's override if they set one,
 * otherwise the default.
 */
export function boundKey(id: ShortcutId, overrides: Record<string, string> = {}): string {
    const override = overrides[id];
    if (typeof override === 'string' && override.length > 0) return override;
    return SHORTCUTS.find(s => s.id === id)?.defaultKey ?? '';
}

/**
 * Key -> command, for the one lookup the keydown handler does per press.
 *
 * Built fresh from the overrides rather than cached, because it is rebuilt
 * only when the preference changes and a stale map is a much worse bug than a
 * negligible allocation. A binding that collides with the digit mute keys or
 * with Escape is dropped: those are not rebindable and an override that
 * shadowed one would silently take a function away.
 */
const RESERVED = new Set(['Escape', '1', '2', '3', '4', '5', '6', '7', '8', '9']);

export function keyMap(overrides: Record<string, string> = {}): Record<string, ShortcutId> {
    const map: Record<string, ShortcutId> = {};
    // Defaults first, then overrides on top, so a player who rebinds A to the
    // command that used to be on B does not end up with both.
    const bound = SHORTCUTS.map(s => [s.id, boundKey(s.id, overrides)] as const);
    const taken = new Set<string>();
    for (const [id, key] of bound) {
        if (!key || RESERVED.has(key)) continue;
        // First writer wins on a collision, which is display order — so a
        // half-finished remap leaves the earlier, more-used command working.
        if (taken.has(key)) continue;
        taken.add(key);
        map[key] = id;
    }
    return map;
}

/**
 * Whether a proposed binding is usable. Surfaced in Settings so a player is
 * told why a key was refused rather than watching it silently not take.
 */
export function shortcutConflict(
    id: ShortcutId, key: string, overrides: Record<string, string> = {},
): string | undefined {
    if (RESERVED.has(key)) return 'That key is reserved for muting categories or closing a panel.';
    if (key === 'Shift' || key === 'Control' || key === 'Alt' || key === 'Meta') return 'Pick a key rather than a modifier.';
    const clash = SHORTCUTS.find(s => s.id !== id && boundKey(s.id, overrides) === key);
    return clash ? `Already bound to "${clash.label}".` : undefined;
}
