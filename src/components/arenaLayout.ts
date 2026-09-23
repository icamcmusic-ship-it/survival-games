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
/**
 * §2.10: the transparent touch target around each node, in viewBox units.
 *
 * The drawn circle is `NODE_R`; this is what a finger has to hit. It is sized
 * against `GRAPH_MIN_WIDTH_PX` below so that the target clears 44 CSS pixels at
 * the smallest width the graph is ever rendered at, and against the measured
 * minimum node separation (78.5 units on the densest 13-zone arenas) so two
 * targets can never overlap.
 */
export const NODE_HIT_R = 36;
/**
 * §2.10: the floor on the graph's rendered width.
 *
 * The SVG was `w-full h-auto` with a 720-unit viewBox, so on a 360px phone it
 * scaled to 0.46 and a 52-unit node drew as a 24px target — a little over half
 * the 44px minimum, on the app's most spatial control. Node count is not the
 * cause but it is why the nodes cannot simply be drawn bigger: at 13 zones
 * there is no room. Below this width the map scrolls horizontally inside its
 * own container instead of shrinking further, which is the same rule the rest
 * of the app already applies to wide content.
 */
export const GRAPH_MIN_WIDTH_PX = 460;
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

    /*
     * The Cornucopia is the map's origin: everything on the floor is described
     * in terms of how far from the horn it is, so drawing it wherever the
     * force solver happened to leave it made the map harder to read than the
     * arena actually is. It is pinned dead centre and the rest of the graph
     * lays out around it.
     *
     * Identified exactly the way the rest of the engine identifies it
     * (`/cornucopia/i` on the zone name — see engine/objectives.ts), because a
     * second, different rule would eventually disagree with the first and the
     * map would centre something the simulation does not treat as the horn.
     * An arena with no such zone simply lays out as it always did.
     */
    const hornName = zones.find(z => /cornucopia/i.test(z.name))?.name;
    const CENTRE: Point = { x: VIEW_W / 2, y: VIEW_H / 2 };
    const pinHorn = () => {
        if (!hornName) return;
        positions[hornName].x = CENTRE.x;
        positions[hornName].y = CENTRE.y;
    };

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

        // The horn is a fixed point the others solve around, not a free node.
        pinHorn();
    }

    // Fit to the viewport with room for the labels under each node.
    const xs = zones.map(z => positions[z.name].x);
    const ys = zones.map(z => positions[z.name].y);
    const minX = Math.min(...xs); const maxX = Math.max(...xs);
    const minY = Math.min(...ys); const maxY = Math.max(...ys);
    const pad = NODE_R + 34;
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);

    if (hornName) {
        /*
         * With the horn pinned, the fit has to be symmetric about the centre —
         * fitting the bounding box to the frame would slide the horn off
         * centre again. So the scale is set by the node that reaches furthest
         * from the middle, and everything is scaled about the middle. That
         * gives up a little of the frame on the slack side, which is why the
         * relaxation below runs afterwards on the drawn coordinates.
         */
        const reachX = Math.max(1, ...zones.map(z => Math.abs(positions[z.name].x - CENTRE.x)));
        const reachY = Math.max(1, ...zones.map(z => Math.abs(positions[z.name].y - CENTRE.y)));
        const scale = Math.min((VIEW_W / 2 - pad) / reachX, (VIEW_H / 2 - pad) / reachY);
        zones.forEach(z => {
            const p = positions[z.name];
            p.x = CENTRE.x + (p.x - CENTRE.x) * scale;
            p.y = CENTRE.y + (p.y - CENTRE.y) * scale;
        });
    } else {
        const scale = Math.min((VIEW_W - pad * 2) / spanX, (VIEW_H - pad * 2) / spanY);
        zones.forEach(z => {
            const p = positions[z.name];
            p.x = pad + (p.x - minX) * scale;
            p.y = pad + (p.y - minY) * scale;
        });
    }

    // §2.10: minimum node separation, on the final drawn coordinates.
    //
    // The force pass keeps nodes comfortably apart *on average* — 78.5 units
    // at 12-14 zones — but the worst case across all 49 arenas was 56.6, and
    // what a finger needs is decided by the worst case, not the average. Two
    // touch targets that overlap mean a tap can land on the wrong zone, which
    // on a map whose whole job is "where is everybody" is the one failure that
    // actually loses information.
    //
    // Runs before the caption pass, because separating nodes is the coarser
    // move and often resolves a caption collision on its own; the caption pass
    // then cleans up what is left.
    const MIN_SEPARATION = NODE_HIT_R * 2 + 2;
    const separate = () => {
        for (let pass = 0; pass < 80; pass++) {
            let moved = false;
            for (let i = 0; i < zones.length; i++) {
                for (let j = i + 1; j < zones.length; j++) {
                    const pa = positions[zones[i].name], pb = positions[zones[j].name];
                    const vx = pb.x - pa.x, vy = pb.y - pa.y;
                    const dist = Math.hypot(vx, vy);
                    if (dist >= MIN_SEPARATION) continue;
                    moved = true;
                    // Two nodes exactly on top of each other have no direction
                    // to separate along; push them apart on x so the next pass
                    // has one.
                    const ux = dist < 0.001 ? 1 : vx / dist;
                    const uy = dist < 0.001 ? 0 : vy / dist;
                    // The horn does not move: its partner takes the whole
                    // push instead of half of it, so separation is still
                    // satisfied without unpinning the centre.
                    const aPinned = zones[i].name === hornName;
                    const bPinned = zones[j].name === hornName;
                    const gap = MIN_SEPARATION - dist;
                    const pushA = bPinned ? gap : gap / 2;
                    const pushB = aPinned ? gap : gap / 2;
                    if (!aPinned) { pa.x -= ux * pushA; pa.y -= uy * pushA; }
                    if (!bPinned) { pb.x += ux * pushB; pb.y += uy * pushB; }
                }
            }
            if (!moved) break;
        }
    };
    separate();

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
    const decollideCaptions = () => {
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
                // As in `separate`: a pinned horn hands its half of the
                // shove to the other caption.
                const aPinned = za.name === hornName;
                const bPinned = zb.name === hornName;
                if (overlapX <= overlapY) {
                    const dir = pa.x <= pb.x ? -1 : 1;
                    const push = (overlapX + 1) * dir;
                    if (!aPinned) pa.x += push * (bPinned ? 1 : 0.5);
                    if (!bPinned) pb.x -= push * (aPinned ? 1 : 0.5);
                } else {
                    const dir = pa.y <= pb.y ? -1 : 1;
                    const push = (overlapY + 1) * dir;
                    if (!aPinned) pa.y += push * (bPinned ? 1 : 0.5);
                    if (!bPinned) pb.y -= push * (aPinned ? 1 : 0.5);
                }
            }
        }
        if (!moved) break;
    }
    };

    // Nudging can push a node past the frame; clamp it back with room for its
    // own caption underneath.
    const clampToFrame = () => zones.forEach(z => {
        if (z.name === hornName) return;
        const p = positions[z.name];
        const halfW = Math.max(NODE_R, (z.name.length * LABEL_CHAR_W) / 2);
        p.x = Math.max(halfW, Math.min(VIEW_W - halfW, p.x));
        p.y = Math.max(NODE_R + 2, Math.min(VIEW_H - NODE_R - LABEL_GAP_Y - LABEL_H - 2, p.y));
    });

    /*
     * Audit 3 §5.5: the three passes have to be run to a fixed point, not once
     * each in order.
     *
     * Separation ran first and then the caption pass and the frame clamp both
     * moved nodes afterwards, either of which can put a pair back inside the
     * touch radius. It went unnoticed because `check-arena-layout` sampled
     * twelve procedural seeds against twelve biomes and a zone count that runs
     * to sixteen; widening that sample to 120 found `procedural-ruinlands`
     * drawing two nodes 71.4 units apart against a 72-unit touch target, which
     * means a tap could land on the wrong zone on the app's most spatial
     * control.
     *
     * Four rounds is comfortably past where these three stop fighting each
     * other on every arena this generator can produce; separation goes last so
     * the touch targets are the property that survives.
     */
    /*
     * Pinning the horn removes two degrees of freedom from the relaxation, so
     * a fixed round count is no longer enough on the tightest procedural maps
     * (`procedural-archipelago` at seed 104 settled with two captions still
     * touching after four). The rounds now run until the two properties the
     * guard measures — touch-target separation and caption clearance — are
     * both actually satisfied, with a cap so the layout can never fail to
     * terminate.
     */
    const violations = () => {
        let count = 0;
        for (let i = 0; i < zones.length; i++) {
            for (let j = i + 1; j < zones.length; j++) {
                const pa = positions[zones[i].name], pb = positions[zones[j].name];
                if (Math.hypot(pb.x - pa.x, pb.y - pa.y) < MIN_SEPARATION) count++;
                const a = labelBox(zones[i].name, pa), b = labelBox(zones[j].name, pb);
                if (a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2) count++;
            }
        }
        return count;
    };
    for (let round = 0; round < 40; round++) {
        decollideCaptions();
        clampToFrame();
        separate();
        if (round >= 3 && violations() === 0) break;
    }
    clampToFrame();
    separate();

    return positions;
}

