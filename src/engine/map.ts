import { Arena, Zone } from '../models/types';

export function zoneNames(arena: Arena): string[] {
    return arena.zones.map(z => z.name);
}

export function getZone(arena: Arena, name: string): Zone | undefined {
    return arena.zones.find(z => z.name === name);
}

// Zones reachable in one move from `from`, excluding collapsed ones.
// Falls back to any active zone if the tribute is stranded (e.g. their zone collapsed).
export function reachableZones(arena: Arena, from: string, collapsed: string[]): Zone[] {
    const active = arena.zones.filter(z => !collapsed.includes(z.name));
    const current = getZone(arena, from);
    if (!current) return active;
    const neighbors = active.filter(z => current.adjacent.includes(z.name));
    return neighbors.length > 0 ? neighbors : active.filter(z => z.name !== from);
}
