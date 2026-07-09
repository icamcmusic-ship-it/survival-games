export interface ZoneNode {
    id: string;
    name: string;
    x: number; // 0-100
    y: number; // 0-100
    adjacentZoneIds: string[];
}

// Deterministically derives a connected map layout from an arena's zone name list:
// the first zone is treated as the central hub (the Cornucopia) connected to every
// other zone, and the remaining zones form a ring connected to their immediate
// neighbors. This keeps movement adjacency-constrained without hand-authoring a
// graph per arena.
export function getZoneGraph(zones: string[]): ZoneNode[] {
    if (zones.length === 0) return [];

    const [hub, ...ring] = zones;
    const nodes: ZoneNode[] = [];

    nodes.push({
        id: hub,
        name: hub,
        x: 50,
        y: 50,
        adjacentZoneIds: [...ring],
    });

    const ringCount = ring.length;
    ring.forEach((zone, i) => {
        const angle = (2 * Math.PI * i) / Math.max(1, ringCount) - Math.PI / 2;
        const x = 50 + 38 * Math.cos(angle);
        const y = 50 + 38 * Math.sin(angle);
        const prev = ring[(i - 1 + ringCount) % ringCount];
        const next = ring[(i + 1) % ringCount];
        const adjacentZoneIds = new Set([hub, prev, next]);
        adjacentZoneIds.delete(zone);
        nodes.push({
            id: zone,
            name: zone,
            x,
            y,
            adjacentZoneIds: [...adjacentZoneIds],
        });
    });

    return nodes;
}

export function getAdjacentZones(zones: string[], currentZone: string): string[] {
    const graph = getZoneGraph(zones);
    const node = graph.find(n => n.id === currentZone);
    return node ? node.adjacentZoneIds : [];
}
