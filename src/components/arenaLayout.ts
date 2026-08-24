/**
 * The arena graph's layout, as a pure function of the arena.
 *
 * Lifted out of `ArenaGraph.tsx` so it can be measured without a DOM: the
 * layout was tuned against the 9-11 zone arenas that existed when it landed,
 * and the only way to know whether the 12-13 zone ones (concrete, tempest,
 * menagerie, carnival, labyrinth, redcathedral, storywood, ashgrove) still
 * read at a small viewport was to be able to run it headlessly and count
 * node separation, label collisions and edge crossings.
 *
 *   npx tsx scripts/check-arena-layout.ts
 */
import { Arena } from '../models/types';

export const NODE_R = 26;
export const VIEW_W = 720;
export const VIEW_H = 460;

export interface Point { x: number; y: number }

/**
 * Caption geometry. The zone name is drawn under its node at 11px in the mono
 * face, which measures ~6.2px per character; the box is what has to stay clear
 * of its neighbours, and it is far wider than the 52px node circle it hangs
 * off. That difference is the whole reason captions collided while nodes never
 * did.
 */
export const LABEL_CHAR_W = 6.2;
export const LABEL_H = 14;
const LABEL_GAP_Y = 4;

export function labelBox(name: string, p: Point) {
    const halfW = Math.max(NODE_R, (name.length * LABEL_CHAR_W) / 2);
    return {
        x1: p.x - halfW, x2: p.x + halfW,
        y1: p.y + NODE_R + LABEL_GAP_Y, y2: p.y + NODE_R + LABEL_GAP_Y + LABEL_H,
    };
}

/**
 * Deterministic force-directed layout.
 *
 * Seeded from the zone order rather than `Math.random`, so the same arena always
 * draws the same shape — a map that rearranged itself on every render would be
 * unreadable, and the arenas are small enough that a fixed iteration count
 * settles well within a frame.
 */
export function layoutZones(arena: Arena): Record<string, Point> {
    const zones = arena.zones;
    const n = zones.length;
    const positions: Record<string, Point> = {};

    // Start on a circle: a decent opening guess for a small planar-ish graph,
    // and one that never starts two nodes on top of each other.
    zones.forEach((z, i) => {
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
        positions[z.name] = {
            x: VIEW_W / 2 + Math.cos(angle) * (VIEW_W * 0.32),
            y: VIEW_H / 2 + Math.sin(angle) * (VIEW_H * 0.34),
        };
    });

    // §1.9: the ideal edge length has to fall as the graph fills up.
    //
    // This was a flat 150 — tuned when every arena had 9-11 zones. At 13 nodes
    // the solver still wants 150px edges in a 720x460 box it cannot have, the
    // fit-to-viewport rescale at the bottom of this function then squeezes the
    // whole thing back down, and what survives the squeeze is a graph whose
    // *captions* sit on top of each other even though its nodes do not.
    // Scaling by the area each node actually gets keeps the pre-fit shape
    // close to the post-fit one, so the solver is solving the layout that
    // gets drawn.
    const IDEAL = Math.max(96, Math.min(150, Math.sqrt((VIEW_W * VIEW_H) / Math.max(1, n)) * 1.05));
    // Captions are wide and short, so nodes need far more horizontal clearance
    // than vertical. Repulsion is stretched along x by the widest caption in
    // the arena rather than being circular.
    const widestLabel = zones.reduce((w, z) => Math.max(w, z.name.length * LABEL_CHAR_W), 0);
    const xStretch = Math.max(1, Math.min(2.2, widestLabel / (NODE_R * 2)));

    for (let step = 0; step < 320; step++) {
        const cooling = 1 - step / 320;

        zones.forEach(a => {
            const pa = positions[a.name];
            let dx = 0;
            let dy = 0;

            zones.forEach(b => {
                if (a.name === b.name) return;
                const pb = positions[b.name];
                const vx = pa.x - pb.x;
                const vy = pa.y - pb.y;
                const dist = Math.max(1, Math.hypot(vx, vy));
                // Everything pushes everything apart — measured in a space
                // squashed along x, so "too close" means too close *for the
                // captions*, not just for the circles.
                const sx = vx / xStretch;
                const shaped = Math.max(1, Math.hypot(sx, vy));
                const repel = (IDEAL * IDEAL) / (shaped * shaped);
                dx += (vx / dist) * repel * 6 * xStretch;
                dy += (vy / dist) * repel * 6;
                // ...and adjacency pulls the connected pairs back together.
                if (a.adjacent.includes(b.name)) {
                    const pull = (dist - IDEAL) / IDEAL;
                    dx -= (vx / dist) * pull * 26;
                    dy -= (vy / dist) * pull * 26;
                }
            });

            // A gentle pull to the middle keeps disconnected zones on screen.
            dx += (VIEW_W / 2 - pa.x) * 0.012;
            dy += (VIEW_H / 2 - pa.y) * 0.012;

            pa.x += dx * cooling * 0.12;
            pa.y += dy * cooling * 0.12;
        });
    }

    // Fit to the viewport with room for the labels under each node.
    const xs = zones.map(z => positions[z.name].x);
    const ys = zones.map(z => positions[z.name].y);
    const minX = Math.min(...xs); const maxX = Math.max(...xs);
    const minY = Math.min(...ys); const maxY = Math.max(...ys);
    const pad = NODE_R + 34;
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    const scale = Math.min((VIEW_W - pad * 2) / spanX, (VIEW_H - pad * 2) / spanY);

    zones.forEach(z => {
        const p = positions[z.name];
        p.x = pad + (p.x - minX) * scale;
        p.y = pad + (p.y - minY) * scale;
    });

    // §1.9: caption de-collision, on the final drawn coordinates.
    //
    // The force pass keeps captions apart in the general case; it cannot
    // guarantee it, because the fit-to-viewport rescale above happens after
    // the forces have settled and can bring two long names back together. This
    // is a short, purely local relaxation over the *actual* label boxes: any
    // overlapping pair is pushed apart along whichever axis needs the smaller
    // shove, which for two wide captions is almost always sideways. Nodes move
    // a few pixels at most, so the graph's shape — the thing a reader is
    // actually reading — is unchanged.
    for (let pass = 0; pass < 60; pass++) {
        let moved = false;
        for (let i = 0; i < zones.length; i++) {
            for (let j = i + 1; j < zones.length; j++) {
                const za = zones[i], zb = zones[j];
                const pa = positions[za.name], pb = positions[zb.name];
                const a = labelBox(za.name, pa), b = labelBox(zb.name, pb);
                const overlapX = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
                const overlapY = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
                if (overlapX <= 0 || overlapY <= 0) continue;
                moved = true;
                // A one-pixel margin, so a pair that settles exactly flush
                // does not read as touching.
                if (overlapX <= overlapY) {
                    const push = (overlapX + 1) / 2 * (pa.x <= pb.x ? -1 : 1);
                    pa.x += push; pb.x -= push;
                } else {
                    const push = (overlapY + 1) / 2 * (pa.y <= pb.y ? -1 : 1);
                    pa.y += push; pb.y -= push;
                }
            }
        }
        if (!moved) break;
    }

    // Nudging can push a node past the frame; clamp it back with room for its
    // own caption underneath.
    zones.forEach(z => {
        const p = positions[z.name];
        const halfW = Math.max(NODE_R, (z.name.length * LABEL_CHAR_W) / 2);
        p.x = Math.max(halfW, Math.min(VIEW_W - halfW, p.x));
        p.y = Math.max(NODE_R + 2, Math.min(VIEW_H - NODE_R - LABEL_GAP_Y - LABEL_H - 2, p.y));
    });

    return positions;
}

