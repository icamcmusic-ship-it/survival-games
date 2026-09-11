/**
 * §4.6: love triangles, as a shape rather than a coincidence.
 *
 * `alliance.ts` models a Star-Crossed bond between two people, and `ROMANCE`
 * models the performed version of the same thing. Both are strictly pairwise,
 * so two romances that happened to share a member were, to the simulation, two
 * unrelated records that both mentioned the same id. Nothing looked at the
 * overlap, and the overlap is the entire story: it is the one romantic
 * configuration that generates conflict on its own, without anybody having to
 * betray anybody.
 *
 * A triangle here is one *apex* — the person both of the others are attached
 * to — and two rivals. It is detected rather than declared, from regard the
 * rest of the engine was already maintaining, and it produces two things a
 * pair cannot:
 *
 *  - **jealousy**, readable in the feed while nothing is happening. The rivals
 *    have to be in a position to see each other for it to build, which is what
 *    `heat` counts.
 *  - **the choice**, forced at a pressure point rather than drifting. The apex
 *    picks, one of them is not picked, and the arena does what the arena does
 *    with that.
 */
import { GameState, Tribute } from '../models/types';
import { ROMANCE, TRIANGLES } from '../data/balance';
import { TRIANGLE_TEXTS } from '../data/flavorText';
import { SimContext, getAlive } from './context';
import { reachableZones, severedEdgeSet } from './map';
import { adjustRel, getRel } from './relationships';
import { cycleOf, ensureMemory, hasStoodBy, swearVengeance } from './memory';
import { areLovers } from './alliance';
import { addExcitement } from './audience';
import { clampTribute } from './vitals';

/** The stored shape, named locally so the resolver can take one. */
type LoveTriangle = NonNullable<GameState['loveTriangles']>[number];

function triangles(state: GameState) {
    if (!state.loveTriangles) state.loveTriangles = [];
    return state.loveTriangles;
}

const fill = (template: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((text, [k, v]) => text.split(`{${k}}`).join(v), template);

/** How attached `t` is to `otherId`, counting a declared bond as the ceiling. */
function attachment(t: Tribute, other: Tribute): number {
    if (areLovers(t, other)) return TRIANGLES.declaredBondRegard;
    return getRel(t, other.id);
}

/**
 * Is there an actual romance here, declared or performed?
 *
 * §4.6: the first cut of the detector asked only for high regard on both
 * sides, and produced 3,970 triangles across 400 runs — ten a run, which is
 * not a love triangle, it is the ordinary warmth inside an alliance being
 * relabelled. The report's framing is the correct gate and it is narrower than
 * regard: a triangle is *two romances sharing a member*, so at least one of
 * the two attachments has to be a real romance — a declared Star-Crossed bond,
 * or a performed one, both of which the engine already marks.
 */
function isRomance(t: Tribute, other: Tribute): boolean {
    if (areLovers(t, other)) return true;
    // A performed bond is recorded as a displayed regard for that specific
    // person — the number they are showing the cameras rather than the one
    // they hold.
    if (t.displayedRegard?.[other.id] !== undefined
        || other.displayedRegard?.[t.id] !== undefined) return true;
    // §4.1: ...or it is simply obvious. Gating every triangle on a declared or
    // performed bond confined the whole subsystem to the minority of runs that
    // produce one, and produced one forced choice in 400 runs. The undeclared
    // version uses exactly the two conditions `growRomance` itself uses, one
    // step below the threshold that would have made it official: regard near
    // the top of the scale on both sides, and somebody having actually risked
    // something for the other. Regard alone is not enough — contact warmth
    // pushes ordinary allies to the clamp, and "warm pair inside an alliance"
    // is precisely the false positive this detector already learned about.
    const mutual = getRel(t, other.id) >= TRIANGLES.romanticRegard
        && getRel(other, t.id) >= TRIANGLES.romanticRegard;
    if (!mutual) return false;
    if (!hasStoodBy(t, other.id) && !hasStoodBy(other, t.id)) return false;
    // ...and the sustained-contact streak `growRomance` gates on, read from
    // whichever side of the pair is carrying it (it is stored once per pair).
    const streak = Math.max(
        ensureMemory(t).contactStreak?.[other.id] ?? 0,
        ensureMemory(other).contactStreak?.[t.id] ?? 0);
    return streak >= ROMANCE.sustainedCycles;
}

/**
 * Detection. Deliberately conservative: at least one leg has to be an actual
 * romance, both rivals have to be genuinely attached, and the apex has to be
 * at least warm to both — a triangle needs the apex to be a real choice rather
 * than one person with two admirers they have never encouraged. Recorded once.
 */
export function detectTriangles(ctx: SimContext) {
    const state = ctx.state;
    const alive = getAlive(state);
    const list = triangles(state);

    alive.forEach(apex => {
        const suitors = alive.filter(o =>
            o.id !== apex.id
            && attachment(o, apex) >= TRIANGLES.suitorRegard
            && getRel(apex, o.id) >= TRIANGLES.apexWarmth);
        if (suitors.length < 2) return;
        // The two most attached. A fourth party is not a squarer triangle, it
        // is the same story with more names in it.
        const [a, b] = suitors.sort((x, y) => attachment(y, apex) - attachment(x, apex));
        // Two admirers is not a triangle. One romance and a rival for it is.
        if (!isRomance(apex, a) && !isRomance(apex, b)) return;
        // One per apex per Games. The story is this person being made to
        // choose, and it happens to them once — without this, a popular apex
        // whose second suitor died simply acquired a new second suitor and the
        // beat replayed with a different name in it.
        if (list.some(tri => tri.apexId === apex.id)) return;
        // ...and nobody is the rival in two of them at once.
        if (list.some(tri => !tri.resolved
            && [tri.aId, tri.bId].some(id => id === a.id || id === b.id))) return;

        list.push({ apexId: apex.id, aId: a.id, bId: b.id, formedCycle: cycleOf(state), heat: 0 });
        ctx.logEvent(
            fill(ctx.pickText(TRIANGLE_TEXTS.formed), { apex: apex.name, a: a.name, b: b.name }),
            [apex.id, a.id, b.id],
            { important: true, category: 'romance' }
        );
    });
}

/**
 * §4.1: how close two rivals have to be for it to be costing them anything.
 *
 * The original gate was strict co-location, which is why the whole subsystem
 * produced one forced choice in 400 runs: two people who want the same person
 * are rivals whether or not they are standing on the same square. Being in
 * the same group is rivalry all day; being one zone apart is rivalry you can
 * see coming. And the sharpest version of all is the apex being with one of
 * them and not the other, which is a thing the person left out feels from
 * wherever they are.
 */
function heatOf(ctx: SimContext, apex: Tribute, a: Tribute, b: Tribute): number {
    if (a.zone === b.zone) return TRIANGLES.heatSameZone;

    const sameGroup = a.allianceId !== undefined && a.allianceId === b.allianceId;
    const adjacent = () => reachableZones(
        ctx.state.arena, a.zone, ctx.state.collapsedZones ?? [], severedEdgeSet(ctx.state),
    ).some(z => z.name === b.zone);
    // Exactly one of them has the apex. The other one knows.
    const apexWithOne = (apex.zone === a.zone) !== (apex.zone === b.zone);

    return (sameGroup || apexWithOne || adjacent()) ? TRIANGLES.heatNearby : 0;
}

/** One cycle of a triangle being a triangle. */
export function tickTriangles(ctx: SimContext) {
    const state = ctx.state;
    const byId = new Map(state.tributes.map(t => [t.id, t] as const));

    state.loveTriangles = triangles(state).filter(tri => {
        const apex = byId.get(tri.apexId);
        const a = byId.get(tri.aId);
        const b = byId.get(tri.bId);
        // The arena resolves most of these itself.
        if (!apex || !a || !b) return false;
        if (apex.status !== 'alive' || a.status !== 'alive' || b.status !== 'alive') return false;
        if (tri.resolved) return true;

        const gain = heatOf(ctx, apex, a, b);
        if (gain <= 0) return true;

        const before = tri.heat;
        tri.heat += gain;
        // Jealousy costs what it costs in proportion to how close they are to
        // each other's throats about it.
        const share = gain / TRIANGLES.heatSameZone;
        adjustRel(a, b.id, -TRIANGLES.jealousyRegardPerCycle * share);
        adjustRel(b, a.id, -TRIANGLES.jealousyRegardPerCycle * share);
        addExcitement(apex, TRIANGLES.excitementPerCycle * share);

        if (before < TRIANGLES.jealousyLineHeat && tri.heat >= TRIANGLES.jealousyLineHeat) {
            ctx.logEvent(
                fill(ctx.pickText(TRIANGLE_TEXTS.jealousy), { apex: apex.name, a: a.name, b: b.name }),
                [a.id, b.id, apex.id],
                { important: true, category: 'romance' }
            );
        }

        // §4.1: it does not wait for the feast. A triangle holds until it
        // cannot hold, and this is the point at which it cannot: the two of
        // them have been doing this long enough that somebody says the thing
        // out loud. The feast and the endgame still force it early.
        if (tri.heat >= TRIANGLES.boilOverHeat) resolveChoice(ctx, tri, byId);
        return true;
    });
}

/**
 * The forced choice. Called at a pressure point — the feast, or the field
 * closing — rather than on a timer: the whole point of a triangle is that it
 * holds until something makes it impossible to hold, and then does not. It is
 * also called by `tickTriangles` once the thing has simply gone on too long.
 */
export function forceTriangleChoice(ctx: SimContext) {
    const byId = new Map(ctx.state.tributes.map(t => [t.id, t] as const));
    triangles(ctx.state).forEach(tri => resolveChoice(ctx, tri, byId));
}

function resolveChoice(ctx: SimContext, tri: LoveTriangle, byId: Map<string, Tribute>) {
    if (tri.resolved || tri.heat < TRIANGLES.choiceMinHeat) return;
    const apex = byId.get(tri.apexId);
    const a = byId.get(tri.aId);
    const b = byId.get(tri.bId);
    if (!apex || !a || !b) return;
    if ([apex, a, b].some(t => t.status !== 'alive')) return;

    tri.resolved = true;
    // They choose whoever they are actually warmer to. A declared
    // Star-Crossed bond outweighs anything unspoken, which is what
    // declaring it is for.
    const chosen = getRel(apex, a.id) + (areLovers(apex, a) ? TRIANGLES.declaredBondRegard : 0)
        >= getRel(apex, b.id) + (areLovers(apex, b) ? TRIANGLES.declaredBondRegard : 0) ? a : b;
    const passed = chosen.id === a.id ? b : a;

    adjustRel(apex, chosen.id, TRIANGLES.chosenRegard);
    adjustRel(chosen, apex.id, TRIANGLES.chosenRegard);
    adjustRel(passed, apex.id, -TRIANGLES.passedOverRegard);
    adjustRel(passed, chosen.id, -TRIANGLES.passedOverRegard);
    passed.vitals.sanity -= TRIANGLES.passedOverSanity;
    clampTribute(passed);
    addExcitement(apex, TRIANGLES.choiceExcitement);
    addExcitement(passed, TRIANGLES.choiceExcitement);

    // Being passed over in an arena is not the same as being passed over
    // anywhere else, and some people take it the way the arena invites.
    const bitter = ctx.rng.chance(TRIANGLES.vengeanceChance);
    if (bitter) swearVengeance(passed, chosen.id);

    // BUG-1.3: this line used to say "twelve people left alive" no matter
    // what. The dayNight caller is gated on a field of five or fewer, so
    // it was guaranteed false there and arbitrary on the feast path.
    const remaining = getAlive(ctx.state).length;
    const vars = { apex: apex.name, chosen: chosen.name, passed: passed.name, remaining: String(remaining) };
    const tail = remaining === 1
        ? 'There is one person left alive in here.'
        : fill(ctx.pickText(TRIANGLE_TEXTS.remaining), vars);
    ctx.logEvent(
        bitter
            ? `${fill(ctx.pickText(TRIANGLE_TEXTS.choiceBitter), vars)} ${tail}`
            : fill(ctx.pickText(TRIANGLE_TEXTS.choiceGracious), vars),
        [apex.id, chosen.id, passed.id],
        { important: true, category: 'romance' }
    );
}
