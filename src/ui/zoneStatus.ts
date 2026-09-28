/**
 * AUDIT-14 F1: what the arena has done to a sector, in words and a glyph.
 *
 * The AUDIT-13 zone states (damaged, ruined, flooded, burning, ash, regrowth),
 * the haunted death sites and the day-8 finale mutation all change forage and
 * concealment, and the map never showed any of them. This is the one place the
 * map, the sector grid and the chronicle read them from.
 */
import { GameState, ZoneStateKind } from '../models/types';
import { AUDIT13_ARENA } from '../data/balance';

export const ZONE_STATE_BADGE: Record<Exclude<ZoneStateKind, 'intact'>, { glyph: string; label: string }> = {
    damaged: { glyph: '◩', label: 'Damaged' },
    ruined: { glyph: '▦', label: 'Ruined' },
    flooded: { glyph: '≈', label: 'Flooded' },
    burning: { glyph: '♨', label: 'Burning' },
    ash: { glyph: '░', label: 'Ash' },
    regrowth: { glyph: '❀', label: 'Regrowth' },
};

/** The sector's state badge, or undefined for an intact sector. */
export function zoneStateBadge(state: GameState, zone: string): { glyph: string; label: string } | undefined {
    const kind = state.zoneStates?.[zone]?.kind;
    return kind && kind !== 'intact' ? ZONE_STATE_BADGE[kind] : undefined;
}

/** A sector where enough people have died that camping there costs sanity. */
export function isHaunted(state: GameState, zone: string): boolean {
    return (state.deathSites?.[zone] ?? 0) >= AUDIT13_ARENA.hauntedSiteDeaths;
}

export const HAUNTED_BADGE = { glyph: '☗', label: 'Haunted' };

/** Short, screen-reader-friendly clause: " Burning. Haunted." or "". */
export function zoneStatusClause(state: GameState, zone: string): string {
    const parts: string[] = [];
    const badge = zoneStateBadge(state, zone);
    if (badge) parts.push(badge.label);
    if (isHaunted(state, zone)) parts.push('Haunted: camping here costs sanity');
    return parts.length ? ` ${parts.join('. ')}.` : '';
}
