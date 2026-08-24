/**
 * Arena-graph legibility guard.
 *
 * `ArenaGraph`'s force-directed layout was tuned against the 9-11 zone arenas
 * that existed when it landed. Eight arenas are now 12-13 zones, and a layout
 * whose ideal edge length does not scale with node count degrades in exactly
 * the way nothing else here would catch: `test:ui` checks for console errors,
 * and a map whose labels sit on top of each other throws none.
 *
 * Three measures, all computed on the final fitted coordinates:
 *
 *   - **separation** — the closest any two nodes come. Below `2 * NODE_R` the
 *     circles themselves overlap.
 *   - **label collisions** — pairs whose zone-name captions overlap. This is
 *     the one that fails first, because captions are far wider than nodes.
 *   - **edge crossings** — a proxy for how tangled the routes read. Some are
 *     unavoidable in a non-planar graph; a jump in the average is not.
 *
 *   npm run test:arena-layout
 */
import { ARENAS } from '../src/data/constants';
import { generateArena } from '../src/engine/arenaGenerator';
import { Arena } from '../src/models/types';
import {
    GRAPH_MIN_WIDTH_PX, NODE_HIT_R, NODE_R, VIEW_W, labelBox, layoutZones, Point,
} from '../src/components/arenaLayout';

/** Node circles must not overlap. */
const MIN_SEPARATION = NODE_R * 2;
/**
 * §2.10: and neither may the touch targets, which are larger than the circles.
 * The graph scales its 720-unit viewBox to whatever width it is given, with a
 * floor at `GRAPH_MIN_WIDTH_PX`, so this is the worst case a finger ever sees.
 */
const MIN_SCALE = GRAPH_MIN_WIDTH_PX / VIEW_W;
/** WCAG 2.5.8's minimum, in CSS pixels. */
const MIN_TOUCH_PX = 44;
/** No arena may draw a caption on top of another caption. */
const MAX_LABEL_COLLISIONS = 0;

interface Measure { id: string; n: number; minSep: number; labelCollisions: number; crossings: number }

function orient(p: Point, q: Point, r: Point): number {
    return Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
}
function crosses(a: Point, b: Point, c: Point, d: Point): boolean {
    return orient(a, b, c) !== orient(a, b, d) && orient(c, d, a) !== orient(c, d, b);
}

export function measure(arena: Arena): Measure {
    const pos = layoutZones(arena);
    const zs = arena.zones;

    let minSep = Infinity;
    for (let i = 0; i < zs.length; i++) {
        for (let j = i + 1; j < zs.length; j++) {
            const a = pos[zs[i].name], b = pos[zs[j].name];
            minSep = Math.min(minSep, Math.hypot(a.x - b.x, a.y - b.y));
        }
    }

    // The same box the layout itself de-collides against, so the guard cannot
    // drift away from the geometry it is guarding.
    const boxes = zs.map(z => labelBox(z.name, pos[z.name]));
    let labelCollisions = 0;
    for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i], b = boxes[j];
            if (a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2) labelCollisions++;
        }
    }

    const seen = new Set<string>();
    const edges: Array<[string, string]> = [];
    zs.forEach(z => z.adjacent.forEach(other => {
        if (!pos[other]) return;
        const key = [z.name, other].sort().join('|');
        if (seen.has(key)) return;
        seen.add(key);
        edges.push([z.name, other]);
    }));
    let crossings = 0;
    for (let i = 0; i < edges.length; i++) {
        for (let j = i + 1; j < edges.length; j++) {
            const [a1, a2] = edges[i], [b1, b2] = edges[j];
            if (a1 === b1 || a1 === b2 || a2 === b1 || a2 === b2) continue;
            if (crosses(pos[a1], pos[a2], pos[b1], pos[b2])) crossings++;
        }
    }

    return { id: arena.id, n: zs.length, minSep: Math.round(minSep * 10) / 10, labelCollisions, crossings };
}

// Procedural arenas are drawn by the same component and vary in size, so a
// spread of seeds is measured alongside the hand-authored ones.
const procedural = Array.from({ length: 12 }, (_, i) => generateArena(`LAYOUT${i}`));
const measured = [...ARENAS, ...procedural].map(measure);

const problems: string[] = [];
measured.forEach(m => {
    if (m.minSep < MIN_SEPARATION) {
        problems.push(`${m.id} (${m.n} zones): closest nodes ${m.minSep}px apart — circles overlap below ${MIN_SEPARATION}px`);
    }
    if (m.labelCollisions > MAX_LABEL_COLLISIONS) {
        problems.push(`${m.id} (${m.n} zones): ${m.labelCollisions} overlapping zone captions`);
    }
    // Two touch targets that overlap mean a tap can land on the wrong zone.
    if (m.minSep < NODE_HIT_R * 2) {
        problems.push(`${m.id} (${m.n} zones): closest nodes ${m.minSep}px apart — touch targets (${NODE_HIT_R * 2}px) overlap`);
    }
});

// §2.10: the target must clear 44 CSS pixels at the narrowest the graph is
// ever drawn. This is a property of the constants rather than of any one
// arena, so it is asserted once — but it is asserted here because it is the
// same trade-off as the layout: bigger nodes need more room, and the 13-zone
// arenas are what decides how much room there is.
const touchPx = Math.round(NODE_HIT_R * 2 * MIN_SCALE * 10) / 10;
if (touchPx < MIN_TOUCH_PX) {
    problems.push(
        `zone touch target is ${touchPx}px at the minimum graph width `
        + `(${GRAPH_MIN_WIDTH_PX}px) — under the ${MIN_TOUCH_PX}px minimum`
    );
}

const bucket = (lo: number, hi: number) => measured.filter(m => m.n >= lo && m.n <= hi);
const avg = (rows: Measure[], pick: (m: Measure) => number) =>
    rows.length === 0 ? 0 : Math.round((rows.reduce((s, m) => s + pick(m), 0) / rows.length) * 10) / 10;

[[6, 10], [11, 11], [12, 14]].forEach(([lo, hi]) => {
    const rows = bucket(lo, hi);
    if (rows.length === 0) return;
    console.log(`${lo}-${hi} zones (n=${rows.length}): minSep ${avg(rows, m => m.minSep)}px, `
        + `label collisions ${avg(rows, m => m.labelCollisions)}, crossings ${avg(rows, m => m.crossings)}`);
});

if (problems.length) {
    console.error('\nPROBLEMS:');
    problems.forEach(p => console.error(` - ${p}`));
    process.exit(1);
}
console.log(`\n${measured.length} arenas laid out; every node pair at least ${MIN_SEPARATION}px apart and no caption overlaps.`);
console.log(`zone touch target: ${touchPx}px at the ${GRAPH_MIN_WIDTH_PX}px minimum graph width (floor ${MIN_TOUCH_PX}px).`);
